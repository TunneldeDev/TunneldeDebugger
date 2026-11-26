import { constants } from "node:fs";
import { mkdir, open, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import spawn from "cross-spawn";
import { strToU8, zip } from "fflate";
import {
  ACCEPTANCE_PRIORITIES,
  ACCEPTANCE_RESULTS,
} from "../shared/acceptance";
import type { AcceptanceReport, ExportedReport } from "../shared/report";
import { PublicError } from "./public-error";

const exec = promisify(execFile);
const MAX_BYTES = 256 * 1024 * 1024;
const validName = /^tunnelde-acceptance-\d{8}T\d{9}Z-[a-f0-9-]{36}\.zip$/;
const inline = (value: string) =>
  value.replace(/[\\`*_[\]<>#]/g, "\\$&").replace(/[\r\n]/g, " ");

function markdown(report: AcceptanceReport, warnings: string[]) {
  const lines = [
    "# Tunnelde 验收报告 / Acceptance report",
    "",
    `生成时间 / Generated: ${report.generatedAt}`,
    `记录数 / Records: ${report.records.length}`,
    "",
    "report.json 保留完整参数、源码身份与测试结果。截图位于 artifacts/，以下路径可离线打开。",
    "report.json preserves full parameters, source identity and test results. Images are bundled in artifacts/ for offline access.",
    "",
  ];
  if (warnings.length)
    lines.push(
      "## 警告 / Warnings",
      "",
      ...warnings.map((warning) => `- ${warning}`),
      "",
    );
  for (const record of report.records) {
    lines.push(
      `## ${record.priority ?? "P2"} · ${inline(record.title || record.scenarioId)}`,
      "",
      `- ID: ${inline(record.id)}`,
      `- 结论 / Result: ${ACCEPTANCE_RESULTS[record.status]} (${record.status})`,
      `- 优先级 / Priority: ${ACCEPTANCE_PRIORITIES[record.priority ?? "P2"]}`,
      `- 场景 / Scene: ${inline(record.scenarioId)} · ${record.target}`,
      `- 更新 / Updated: ${record.updatedAt}`,
      `- 源码 / Source: ${inline(record.source.path)} @ ${inline(record.source.revision)}`,
      `- 工作区指纹 / Fingerprint: ${inline(record.source.dirtyFingerprint)}`,
      "",
      "### 问题描述 / Description",
      "",
      record.note || "—",
      "",
    );
    if (record.steps) lines.push("### 复现步骤 / Steps", "", record.steps, "");
    if (record.expected)
      lines.push("### 预期结果 / Expected", "", record.expected, "");
    if (record.checklist?.length)
      lines.push(
        "### 已选检查项 / Checked items",
        "",
        ...record.checklist.map((item) => `- ${inline(item)}`),
        "",
      );
    for (const name of record.screenshots) {
      if (/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/.test(name))
        lines.push(`![${name}](artifacts/${name})`, "");
    }
  }
  return lines.join("\n");
}

/** Persist a complete, immutable export before offering downloads or revealing it. */
export class ReportExporter {
  constructor(private data: string) {}

  async create(input: AcceptanceReport): Promise<ExportedReport> {
    const report = structuredClone(input);
    report.records = report.records.filter((record) => !record.deletedAt);
    const warnings: string[] = [];
    const files: Record<string, Uint8Array> = Object.create(null);
    const names = new Set(
      report.records.flatMap((record) => record.screenshots),
    );
    let bytes = 0,
      screenshotCount = 0;
    for (const name of names) {
      if (!/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/.test(name)) {
        warnings.push(
          "附件名称无效，未打包 / Invalid attachment name; not bundled",
        );
        continue;
      }
      let handle;
      try {
        handle = await open(
          join(this.data, "artifacts", name),
          constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
        );
        const info = await handle.stat();
        if (!info.isFile()) throw new Error("Not a regular file");
        if (info.size + bytes > MAX_BYTES)
          throw new PublicError(
            "报告附件超过 256 MiB / Report attachments exceed 256 MiB",
          );
        const image = await handle.readFile();
        bytes += image.length;
        if (bytes > MAX_BYTES)
          throw new PublicError(
            "报告附件超过 256 MiB / Report attachments exceed 256 MiB",
          );
        files[`artifacts/${name}`] = image;
        screenshotCount++;
      } catch (error) {
        if (error instanceof PublicError) throw error;
        if (
          ["ENOENT", "ELOOP"].includes(
            (error as NodeJS.ErrnoException).code ?? "",
          )
        )
          warnings.push(
            `附件不存在或不安全 / Attachment missing or unsafe: ${name}`,
          );
        else
          throw new PublicError(
            `无法读取附件 / Cannot read attachment: ${name}`,
          );
      } finally {
        await handle?.close();
      }
    }
    files["report.json"] = strToU8(
      JSON.stringify({ ...report, exportWarnings: warnings }, null, 2),
    );
    files["report.md"] = strToU8(markdown(report, warnings));
    const archive = await new Promise<Uint8Array>((resolve, reject) => {
      zip(files, { level: 0 }, (error, result) =>
        error ? reject(error) : resolve(result),
      );
    });
    const filename = `tunnelde-acceptance-${new Date().toISOString().replace(/[-:.]/g, "")}-${randomUUID()}.zip`;
    const directory = join(this.data, "exports");
    const path = join(directory, filename),
      temporary = `${path}.tmp`;
    try {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(archive);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, path);
    } catch {
      await rm(temporary, { force: true }).catch(() => {});
      throw new PublicError(
        "报告保存失败，请检查记录目录权限和磁盘空间 / Cannot save report; check directory permissions and disk space",
      );
    }
    return {
      filename,
      path,
      downloadUrl: `/api/reports/${filename}`,
      recordCount: report.records.length,
      screenshotCount,
      warnings,
    };
  }

  async path(filename: string) {
    if (!validName.test(filename))
      throw new PublicError("报告不存在 / Report not found", 404);
    const path = join(this.data, "exports", filename);
    const info = await stat(path).catch(() => undefined);
    if (!info?.isFile())
      throw new PublicError("报告不存在 / Report not found", 404);
    return path;
  }

  async reveal(filename: string) {
    const path = await this.path(filename);
    try {
      if (process.platform === "darwin")
        await exec("open", ["-R", path], { timeout: 10000 });
      // Explorer can exit with code 1 after handing off to an existing process.
      // Treat successful process creation as acceptance by the OS, not failure.
      else if (process.platform === "win32")
        await new Promise<void>((resolve, reject) => {
          const child = spawn("explorer.exe", [`/select,${path}`], {
            detached: true,
            stdio: "ignore",
          });
          child.once("error", reject);
          child.once("spawn", () => {
            child.unref();
            resolve();
          });
        });
      else
        await exec("xdg-open", [join(this.data, "exports")], {
          timeout: 10000,
        });
    } catch {
      throw new PublicError(
        "无法打开导出目录，请按显示的路径手动打开 / Cannot open export directory; use the displayed path",
      );
    }
  }
}
