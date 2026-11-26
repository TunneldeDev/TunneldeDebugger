import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { ReportExporter } from "../server/report";
import { DEFAULT_PARAMETERS, type AcceptanceRecord } from "../shared/protocol";
import type { AcceptanceReport } from "../shared/report";

const source = {
  path: "/original/project",
  revision: "original-revision",
  dirtyFingerprint: "original-dirty",
  protocol: 1,
};
const record: AcceptanceRecord = {
  id: "one",
  scenarioId: "forms",
  target: "browser",
  source,
  parameters: DEFAULT_PARAMETERS,
  status: "failed",
  priority: "P1",
  title: "Unicode 问题",
  note: "Description\nSecond line",
  steps: "Click save",
  expected: "Visible feedback",
  screenshots: ["test.png", "test.png"],
  updatedAt: new Date().toISOString(),
};
const report: AcceptanceReport = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source,
  records: [record],
};

test("report export persists portable records and deduplicated images; deleted records stay excluded", async () => {
  const data = await mkdtemp(join(tmpdir(), "debugger-report-"));
  try {
    await mkdir(join(data, "artifacts"));
    const image = Buffer.from("89504e470d0a1a0a", "hex");
    await writeFile(join(data, "artifacts", "test.png"), image);
    const exporter = new ReportExporter(data);
    const result = await exporter.create({
      ...report,
      records: [
        record,
        {
          ...record,
          id: "deleted",
          deletedAt: new Date().toISOString(),
          screenshots: ["deleted.png"],
        },
      ],
    });
    assert.equal(result.recordCount, 1);
    assert.equal(result.screenshotCount, 1);
    assert.deepEqual(result.warnings, []);
    assert.equal(await exporter.path(result.filename), result.path);
    const files = unzipSync(await exporter.read(result.filename));
    assert.deepEqual(Object.keys(files).sort(), [
      "artifacts/test.png",
      "report.json",
      "report.md",
    ]);
    assert.deepEqual(Buffer.from(files["artifacts/test.png"]!), image);
    assert.deepEqual(JSON.parse(strFromU8(files["report.json"]!)).records, [
      record,
    ]);
    const markdown = strFromU8(files["report.md"]!);
    for (const text of [
      "P1",
      record.title!,
      record.note,
      record.steps!,
      record.expected!,
      source.revision,
      source.dirtyFingerprint,
      "artifacts/test.png",
    ])
      assert.ok(markdown.includes(text), text);
    // A new service instance can download an existing export without memory state.
    assert.equal(
      await new ReportExporter(data).path(result.filename),
      result.path,
    );
    assert.deepEqual(
      await new ReportExporter(data).read(result.filename),
      await readFile(result.path),
    );
    assert.notEqual((await exporter.create(report)).filename, result.filename);
  } finally {
    await rm(data, { recursive: true, force: true });
  }
});

test("missing and unsafe attachments produce visible warnings without reading outside artifacts", async () => {
  const data = await mkdtemp(join(tmpdir(), "debugger-report-"));
  try {
    await mkdir(join(data, "artifacts"));
    const exporter = new ReportExporter(data);
    const result = await exporter.create({
      ...report,
      records: [{ ...record, screenshots: ["missing.png", "../private.png"] }],
    });
    assert.equal(result.warnings.length, 2);
    assert.equal(result.screenshotCount, 0);
    const files = unzipSync(await readFile(result.path));
    assert.equal(
      JSON.parse(strFromU8(files["report.json"]!)).exportWarnings.length,
      2,
    );
    assert.match(strFromU8(files["report.md"]!), /missing.png/);
    await assert.rejects(exporter.path("../report.zip"), /not found/);
    await assert.rejects(exporter.read("../report.zip"), /not found/);
    await assert.rejects(
      exporter.path(
        result.filename.replace(
          /-[a-f0-9-]{36}\.zip$/,
          "-00000000-0000-0000-0000-000000000000.zip",
        ),
      ),
      /not found/,
    );
    if (process.platform !== "win32") {
      await writeFile(join(data, "private.png"), "private");
      await symlink(
        join(data, "private.png"),
        join(data, "artifacts", "linked.png"),
      );
      const linked = await exporter.create({
        ...report,
        records: [{ ...record, screenshots: ["linked.png"] }],
      });
      assert.equal(linked.screenshotCount, 0);
      assert.equal(linked.warnings.length, 1);
      const linkName =
        "tunnelde-acceptance-20000101T000000000Z-00000000-0000-0000-0000-000000000000.zip";
      await symlink(join(data, "private.png"), join(data, "exports", linkName));
      await assert.rejects(exporter.read(linkName), /cannot be read/);
    }
  } finally {
    await rm(data, { recursive: true, force: true });
  }
});

test("report persistence failure rejects instead of reporting success", async () => {
  const data = await mkdtemp(join(tmpdir(), "debugger-report-"));
  try {
    await writeFile(join(data, "exports"), "not a directory");
    await assert.rejects(
      new ReportExporter(data).create({ ...report, records: [] }),
      /Cannot save report/,
    );
  } finally {
    await rm(data, { recursive: true, force: true });
  }
});
