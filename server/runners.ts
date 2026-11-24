import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type {
  RunEvent,
  RunnerKind,
  RunStatus,
  TestItem,
  TestRunnerAdapter,
} from "../shared/protocol";
import { runProcess } from "./process";
const root = fileURLToPath(new URL("../", import.meta.url));
const escapeRegex = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export async function walk(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const result: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (["node_modules", "target", ".git", ".tmp", "dist"].includes(entry.name))
      continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(path)));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}
export function parseJsonOutput(output: string): unknown {
  for (let i = 0; i < output.length; i++) {
    const char = output[i];
    if (char !== "[" && char !== "{") continue;
    try {
      return JSON.parse(output.slice(i).trim());
    } catch {
      /* tools may print a warning before JSON */
    }
  }
  throw new Error(
    `No structured output from test discovery: ${output.slice(-2000)}`,
  );
}
export class Runner implements TestRunnerAdapter {
  constructor(
    readonly kind: RunnerKind,
    readonly target: string,
  ) {}
  async discover(): Promise<TestItem[]> {
    const prefix = this.kind;
    if (prefix === "vitest") {
      const result = await runProcess(
        "pnpm",
        ["exec", "vitest", "list", "--json", "--includeTaskLocation"],
        { cwd: this.target, timeout: 300000 },
      );
      if (result.code !== 0)
        throw new Error(
          result.cancelled
            ? "Test discovery timed out or was interrupted"
            : result.output || `Test discovery exited (${result.code})`,
        );
      const cases = parseJsonOutput(result.output) as Array<{
        name: string;
        file: string;
      }>;
      const files = new Map<string, TestItem>();
      for (const item of cases) {
        const file = relative(this.target, item.file);
        if (!files.has(file))
          files.set(file, {
            id: `${prefix}:${file}`,
            runner: prefix,
            label: file,
            file,
            children: [],
          });
        files.get(file)!.children!.push({
          id: `${prefix}:${file}#${item.name}`,
          runner: prefix,
          label: item.name,
          file,
          name: item.name,
        });
      }
      return [...files.values()];
    }
    if (prefix === "node") {
      return (await walk(join(this.target, "scripts")))
        .filter((path) => /\.test\.(mjs|cjs|js)$/.test(path))
        .map((path) => ({
          id: `${prefix}:${relative(this.target, path)}`,
          runner: prefix,
          label: relative(this.target, path),
          file: relative(this.target, path),
        }));
    }
    if (prefix === "playwright") {
      const result = await runProcess(
        "pnpm",
        ["exec", "playwright", "test", "--list", "--reporter=json"],
        { cwd: root, env: { TUNNELDE_TARGET: this.target }, timeout: 30000 },
      );
      if (result.code !== 0)
        throw new Error(
          result.cancelled
            ? "Test discovery timed out or was interrupted"
            : result.output || `Test discovery exited (${result.code})`,
        );
      const data = parseJsonOutput(result.output) as {
        suites: Array<{
          file: string;
          title: string;
          specs: Array<{ title: string; file: string }>;
          suites: unknown[];
        }>;
      };
      return data.suites.map((suite) => ({
        id: `${prefix}:${suite.file}`,
        runner: prefix,
        label: suite.file,
        file: suite.file,
        children: suite.specs.map((spec) => ({
          id: `${prefix}:${spec.file}#${spec.title}`,
          runner: prefix,
          label: spec.title,
          name: spec.title,
          file: spec.file,
        })),
      }));
    }
    if (prefix === "rust") {
      const artifactLines: string[] = [];
      const result = await runProcess(
        "cargo",
        [
          "test",
          "--locked",
          "--manifest-path",
          "src-tauri/Cargo.toml",
          "--no-run",
          "--message-format=json",
        ],
        {
          cwd: this.target,
          timeout: 600000,
          onLine: (line) => {
            if (line.includes('"compiler-artifact"')) artifactLines.push(line);
          },
        },
      );
      if (result.code !== 0) throw new Error(result.output.slice(-6000));
      const artifacts = artifactLines.flatMap((line) => {
        try {
          const row = JSON.parse(line);
          return row.reason === "compiler-artifact" &&
            row.profile?.test &&
            row.executable
            ? [row]
            : [];
        } catch {
          return [];
        }
      });
      const items: TestItem[] = [];
      for (const artifact of artifacts) {
        const listing = await runProcess(
          artifact.executable,
          ["--list", "--format=terse"],
          { cwd: this.target, timeout: 30000 },
        );
        if (listing.code !== 0) throw new Error(listing.output);
        const ignoredListing = await runProcess(
          artifact.executable,
          ["--ignored", "--list", "--format=terse"],
          { cwd: this.target, timeout: 30000 },
        );
        const ignored = new Set(
          ignoredListing.output
            .split("\n")
            .filter((line) => line.endsWith(": test"))
            .map((line) => line.slice(0, -6)),
        );
        const target = artifact.target.kind.some((kind: string) =>
          ["lib", "rlib", "staticlib", "cdylib"].includes(kind),
        )
          ? "lib"
          : `${artifact.target.kind.includes("test") ? "test" : "bin"}:${artifact.target.name}`;
        const names = listing.output
          .split("\n")
          .filter((line) => line.endsWith(": test"))
          .map((line) => line.slice(0, -6));
        items.push({
          id: `rust:${target}`,
          runner: prefix,
          label: artifact.target.name,
          ...(names.length
            ? {}
            : { unavailable: "No test cases in this compiled target" }),
          target,
          children: names.map((name) => ({
            id: `rust:${target}#${name}`,
            runner: prefix,
            label: name,
            name,
            target,
            ignored: ignored.has(name),
          })),
        });
      }
      return items;
    }
    return [];
  }
  async run(
    items: TestItem[],
    signal: AbortSignal,
    emit: (event: Omit<RunEvent, "sequence" | "time">) => void,
  ): Promise<RunStatus> {
    let failed = false;
    for (const item of items) {
      if (signal.aborted) return "cancelled";
      if (item.ignored || item.unavailable) {
        emit({
          type: "case",
          itemId: item.id,
          status: "skipped",
          text: item.unavailable ?? "Ignored by the test suite",
        });
        continue;
      }
      const command =
        this.kind === "rust"
          ? "cargo"
          : this.kind === "node"
            ? process.execPath
            : "pnpm";
      let args: string[];
      let cwd = this.target;
      if (this.kind === "vitest")
        args = [
          "exec",
          "vitest",
          "run",
          resolve(this.target, item.file!),
          ...(item.name
            ? ["-t", `^${escapeRegex(item.name.replace(/ > /g, " "))}$`]
            : []),
          "--reporter",
          join(root, "server/reporters/vitest.mjs"),
        ];
      else if (this.kind === "node")
        args = [
          "--test",
          "--test-reporter",
          // Node imports custom reporters as ESM; Windows drive paths need a file URL.
          pathToFileURL(join(root, "server/reporters/node.mjs")).href,
          ...(item.name
            ? ["--test-name-pattern", `^${escapeRegex(item.name)}$`]
            : []),
          resolve(this.target, item.file!),
        ];
      else if (this.kind === "playwright") {
        cwd = root;
        args = [
          "exec",
          "playwright",
          "test",
          item.file!,
          ...(item.name ? ["--grep", `(?:^| )${escapeRegex(item.name)}$`] : []),
          "--reporter",
          join(root, "server/reporters/playwright.mjs"),
        ];
      } else
        args = [
          "test",
          "--locked",
          "--manifest-path",
          "src-tauri/Cargo.toml",
          ...(item.target === "lib"
            ? ["--lib"]
            : item.target?.startsWith("bin:")
              ? ["--bin", item.target.slice(4)]
              : item.target?.startsWith("test:")
                ? ["--test", item.target.slice(5)]
                : []),
          ...(item.name ? [item.name] : []),
          "--",
          ...(item.name ? ["--exact"] : []),
          "--nocapture",
        ];
      emit({ type: "case", itemId: item.id, status: "running" });
      const started = Date.now();
      let executed = 0;
      const result = await runProcess(command, args, {
        cwd,
        signal,
        env: { TUNNELDE_TARGET: this.target },
        onLine: (line) => {
          if (line.startsWith("@@TDEBUG@@")) {
            try {
              const event = JSON.parse(line.slice(10));
              if (
                ["passed", "failed"].includes(event.status) &&
                event.type !== "log"
              )
                executed++;
              const childId =
                event.type === "log" || !event.text
                  ? item.id
                  : `${this.kind}:${item.file}#${event.text}`;
              emit({ type: "case", ...event, itemId: childId });
              return;
            } catch {
              /* retain malformed reporter output */
            }
          }
          const rustCase = /^test (.+) \.\.\. (ok|FAILED|ignored)/.exec(line);
          if (rustCase && rustCase[2] !== "ignored") executed++;
          if (rustCase)
            emit({
              type: "case",
              itemId: `rust:${item.target}#${rustCase[1]}`,
              status:
                rustCase[2] === "ok"
                  ? "passed"
                  : rustCase[2] === "ignored"
                    ? "skipped"
                    : "failed",
            });
          emit({ type: "log", itemId: item.id, text: line });
        },
      });
      const status: RunStatus = result.cancelled
        ? "cancelled"
        : result.code === 0 && (!item.name || executed > 0)
          ? "passed"
          : "failed";
      emit({
        type: "case",
        itemId: item.id,
        status,
        duration: Date.now() - started,
      });
      if (result.cancelled) return "cancelled";
      if (status === "failed") {
        failed = true;
        if (result.code === 0 && item.name && !executed)
          emit({
            type: "log",
            itemId: item.id,
            text: "Selected test did not execute; zero-test success rejected",
          });
      }
    }
    return failed ? "failed" : "passed";
  }
}
export function flattenTests(items: TestItem[]): TestItem[] {
  return items.flatMap((item) => [item, ...flattenTests(item.children ?? [])]);
}
export function collapseSelection(items: TestItem[]): TestItem[] {
  return items.filter(
    (item) =>
      !items.some(
        (parent) =>
          parent !== item &&
          flattenTests(parent.children ?? []).some(
            (child) => child.id === item.id,
          ),
      ),
  );
}
