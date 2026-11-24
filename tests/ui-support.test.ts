import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ansiSegments } from "../shared/ansi";
import { settingsStore, validateSettings } from "../server/settings";
import { runProcess } from "../server/process";
test("ANSI logs preserve SGR colors and reset while dropping terminal controls", () => {
  const segments = ansiSegments(
    "\x1b[1m\x1b[33mwarning\x1b[0m: text\x1b[38;2;12;34;56m RGB\x1b[0m\x1b]8;;javascript:bad\x07plain\x1b]8;;\x07",
  );
  assert.equal(segments.map((x) => x.text).join(""), "warning: text RGBplain");
  assert.equal(segments[0]!.fontWeight, 700);
  assert.ok(segments[0]!.color);
  assert.equal(segments[1]!.color, undefined);
  assert.equal(segments[2]!.color, "rgb(12, 34, 56)");
  assert.equal(
    ansiSegments("old progress\rnew progress\x1b[2K")
      .map((x) => x.text)
      .join(""),
    "new progress",
  );
  assert.equal(ansiSegments("\x1b[38;5;196m256")[0]!.color, "rgb(255, 0, 0)");
});
test("project configuration persists; invalid ports, shell-shaped arguments and isolation overrides are rejected", async () => {
  const path = await mkdtemp(join(tmpdir(), "debugger-settings-"));
  try {
    const store = settingsStore(path, join(path, "target"));
    const defaults = await store.read();
    const next = validateSettings({
      ...defaults,
      servicePort: 4870,
      launch: {
        cargoArgs: ["--locked", "-j", "2"],
        appArgs: ["value with spaces"],
        env: { RUST_LOG: "debug" },
      },
    });
    await store.write(next);
    assert.deepEqual(await settingsStore(path, "unused").read(), next);
    assert.throws(() => validateSettings({ ...next, servicePort: 65534 }));
    assert.throws(() => validateSettings({ ...next, targetPath: "relative" }));
    assert.throws(() =>
      validateSettings({
        ...next,
        launch: { ...next.launch, cargoArgs: "--locked" },
      }),
    );
    assert.throws(() =>
      validateSettings({
        ...next,
        launch: { ...next.launch, cargoArgs: ["--release"] },
      }),
    );
    assert.throws(() =>
      validateSettings({
        ...next,
        launch: { ...next.launch, env: { TUNNELDE_DATA_DIR: "/daily-data" } },
      }),
    );
  } finally {
    await rm(path, { recursive: true, force: true });
  }
});
test("colored process output enables color only when requested", async () => {
  const result = await runProcess(
    process.execPath,
    [
      "-e",
      "process.stdout.write(JSON.stringify({color:process.env.FORCE_COLOR,noColor:process.env.NO_COLOR}))",
    ],
    { cwd: process.cwd(), color: true },
  );
  assert.equal(result.code, 0);
  assert.deepEqual(JSON.parse(result.output), { color: "1" });
});
