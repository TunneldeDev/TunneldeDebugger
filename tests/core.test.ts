import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scenarios } from "../shared/scenarios";
import { DEFAULT_PARAMETERS, validateParameters } from "../shared/protocol";
import { JsonStore } from "../server/storage";
import { runProcess } from "../server/process";
import { collapseSelection, parseJsonOutput, Runner } from "../server/runners";
test("scenario catalogue has unique stable IDs and executable targets", () => {
  assert.equal(
    new Set(scenarios.map((scene) => scene.id)).size,
    scenarios.length,
  );
  assert.equal(
    scenarios.filter((scene) => scene.id.startsWith("settings-")).length,
    14,
  );
  for (const scene of scenarios) {
    assert.ok(scene.targets.includes("browser"));
    assert.ok(scene.checklist.length);
    assert.ok(scene.presets.includes("boundary"));
  }
});
test("scenario parameters reject invalid and unbounded inputs", () => {
  assert.deepEqual(validateParameters(DEFAULT_PARAMETERS), DEFAULT_PARAMETERS);
  for (const patch of [
    { count: 10001 },
    { width: 0 },
    { seed: NaN },
    { preset: "arbitrary" },
    { locale: "bad" },
  ])
    assert.throws(() =>
      validateParameters({ ...DEFAULT_PARAMETERS, ...patch }),
    );
});
test("atomic storage preserves the latest concurrent save", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tunnelde-debugger-"));
  try {
    const store = new JsonStore(join(directory, "history.json"), { value: 0 });
    assert.deepEqual(await store.read(), { value: 0 });
    await Promise.all(
      Array.from({ length: 30 }, (_, value) => store.write({ value })),
    );
    assert.deepEqual(await store.read(), { value: 29 });
  } finally {
    await rm(directory, { recursive: true });
  }
});
test("process cancellation terminates a running process", async () => {
  const controller = new AbortController();
  const task = runProcess(
    process.execPath,
    ["-e", "setInterval(() => {}, 1000)"],
    {
      cwd: tmpdir(),
      signal: controller.signal,
      onChild: () => setTimeout(() => controller.abort(), 100),
    },
  );
  assert.equal((await task).cancelled, true);
});
test("structured discovery output tolerates pnpm warnings", () => {
  assert.deepEqual(
    parseJsonOutput('[WARN] package notice\n[{"name":"test"}]\n'),
    [{ name: "test" }],
  );
});
test("selecting a file and its child does not execute a test twice", () => {
  const child = {
    id: "node:file#case",
    label: "case",
    runner: "node" as const,
  };
  const parent = {
    id: "node:file",
    label: "file",
    runner: "node" as const,
    children: [child],
  };
  assert.deepEqual(collapseSelection([child, parent]), [parent]);
});
test("Node runner reports real failure and successful individual selection", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tunnelde-runner-"));
  try {
    await writeFile(
      join(directory, "sample.test.mjs"),
      "import { test } from 'node:test'; import assert from 'node:assert/strict'; test('pass', () => assert.equal(1,1)); test('fail', () => assert.equal(1,2));",
    );
    const runner = new Runner("node", directory);
    const events: unknown[] = [];
    const item = {
      id: "node:sample.test.mjs",
      label: "sample",
      runner: "node" as const,
      file: "sample.test.mjs",
    };
    assert.equal(
      await runner.run([item], new AbortController().signal, (event) =>
        events.push(event),
      ),
      "failed",
    );
    assert.equal(
      await runner.run(
        [{ ...item, name: "pass" }],
        new AbortController().signal,
        (event) => events.push(event),
      ),
      "passed",
    );
    assert.ok(
      events.some(
        (event) => (event as { status?: string }).status === "failed",
      ),
    );
    assert.equal(
      await runner.run(
        [{ ...item, name: "missing case" }],
        new AbortController().signal,
        () => {},
      ),
      "failed",
    );
  } finally {
    await rm(directory, { recursive: true });
  }
});
test("startup recovery marks pending runs interrupted and preserves finished evidence", async () => {
  const { Scheduler } = await import("../server/scheduler");
  const directory = await mkdtemp(join(tmpdir(), "tunnelde-recovery-"));
  try {
    await writeFile(
      join(directory, "runs.json"),
      JSON.stringify([
        {
          id: "old",
          status: "running",
          events: [{ sequence: 1, text: "checkpoint" }],
        },
        { id: "done", status: "passed", events: [] },
      ]),
    );
    const scheduler = new Scheduler(process.cwd(), directory, () => {});
    await scheduler.initialize();
    assert.equal(scheduler.runs[0]!.status, "interrupted");
    assert.equal(scheduler.runs[1]!.status, "passed");
    assert.equal(scheduler.runs[0]!.events[0]!.text, "checkpoint");
    await scheduler.dispose();
  } finally {
    await rm(directory, { recursive: true });
  }
});
test("native protocol decodes split Unicode and rejects mismatched response identities", async () => {
  const { createServer } = await import("node:net");
  const { nativeCall } = await import("../server/native");
  const directory = await mkdtemp(join(tmpdir(), "tunnelde-wire-"));
  let mismatch = false;
  const server = createServer((socket) =>
    socket.once("data", (data) => {
      const request = JSON.parse(data.toString());
      const buffer = Buffer.from(
        JSON.stringify({
          version: 1,
          id: mismatch ? "wrong" : request.id,
          result: { message: "验收 🚇" },
        }) + "\n",
      );
      const split = buffer.indexOf(Buffer.from("🚇")) + 1;
      socket.write(buffer.subarray(0, split));
      setTimeout(() => socket.end(buffer.subarray(split)), 10);
    }),
  );
  try {
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const port = (server.address() as { port: number }).port;
    const path = join(directory, "endpoint.json");
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        address: `127.0.0.1:${port}`,
        token: "a".repeat(64),
        runId: "test",
      }),
    );
    assert.deepEqual(await nativeCall(path, "debug.describe"), {
      message: "验收 🚇",
    });
    mismatch = true;
    await assert.rejects(nativeCall(path, "debug.describe"), /Mismatched/);
  } finally {
    server.close();
    await rm(directory, { recursive: true });
  }
});
test("Node nested case IDs preserve ancestry and select exactly one duplicate name", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tunnelde-nested-"));
  try {
    await writeFile(
      join(directory, "nested.test.mjs"),
      "import {describe,it} from 'node:test'; import assert from 'node:assert/strict'; describe('first',()=>{it('duplicate',()=>assert.ok(true))}); describe('second',()=>{it('duplicate',()=>assert.fail('excluded'))});",
    );
    const runner = new Runner("node", directory);
    const events: any[] = [];
    const item = {
      id: "node:nested.test.mjs",
      runner: "node" as const,
      label: "nested",
      file: "nested.test.mjs",
    };
    assert.equal(
      await runner.run([item], new AbortController().signal, (e) =>
        events.push(e),
      ),
      "failed",
    );
    assert.ok(
      events.some(
        (e) =>
          e.itemId === "node:nested.test.mjs#first duplicate" &&
          e.status === "passed",
      ),
    );
    events.length = 0;
    assert.equal(
      await runner.run(
        [
          {
            ...item,
            id: item.id + "#first duplicate",
            name: "first duplicate",
          },
        ],
        new AbortController().signal,
        (e) => events.push(e),
      ),
      "passed",
    );
    assert.ok(!events.some((e) => e.status === "failed"));
  } finally {
    await rm(directory, { recursive: true });
  }
});
test("scheduler cancellation releases serial queue and a failed selection can be rerun", async () => {
  const { Scheduler } = await import("../server/scheduler");
  const directory = await mkdtemp(join(tmpdir(), "tunnelde-queue-"));
  let active = 0;
  let high = 0;
  const scheduler = new Scheduler(
    directory,
    directory,
    () => {},
    () => ({
      kind: "node",
      async discover() {
        return [];
      },
      async run(items, signal, emit) {
        active++;
        high = Math.max(high, active);
        try {
          if (items[0]!.name === "wait")
            await new Promise<void>((resolve) => {
              signal.addEventListener("abort", () => resolve(), { once: true });
              if (signal.aborted) resolve();
            });
          if (items[0]!.name === "volume") {
            emit({
              type: "case",
              itemId: "node:queue#early-failure",
              status: "failed",
            });
            for (let i = 0; i < 4200; i++)
              emit({ type: "log", text: `output ${i}` });
          }
          const status = signal.aborted
            ? "cancelled"
            : ["fail", "volume"].includes(items[0]!.name!)
              ? "failed"
              : "passed";
          emit({ type: "case", itemId: items[0]!.id, status });
          return status;
        } finally {
          active--;
        }
      },
    }),
  );
  try {
    await runProcess("git", ["init"], { cwd: directory });
    await runProcess(
      "git",
      [
        "-c",
        "user.name=Debugger tests",
        "-c",
        "user.email=debugger@example.test",
        "commit",
        "--allow-empty",
        "-m",
        "fixture",
      ],
      { cwd: directory },
    );
    await scheduler.initialize();
    const item = {
      id: "node:queue#wait",
      runner: "node" as const,
      label: "wait",
      name: "wait",
    };
    const first = await scheduler.enqueue([item]);
    const second = await scheduler.enqueue([
      { ...item, id: "node:queue#fail", name: "fail" },
    ]);
    await scheduler.cancel(first.id);
    const wait = async () => {
      const deadline = Date.now() + 3000;
      while (
        scheduler.runs.some((r) => ["queued", "running"].includes(r.status))
      ) {
        assert.ok(Date.now() < deadline);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    };
    await wait();
    assert.equal(first.status, "cancelled");
    assert.equal(second.status, "failed");
    const rerun = await scheduler.enqueue([
      { ...item, id: "node:queue#pass", name: "pass" },
    ]);
    await wait();
    assert.equal(rerun.status, "passed");
    const volume = await scheduler.enqueue([
      { ...item, id: "node:queue#volume", name: "volume" },
    ]);
    await wait();
    await scheduler.dispose();
    assert.equal(volume.results!["node:queue#early-failure"]!.status, "failed");
    assert.ok(
      !volume.events.some((e) => e.itemId === "node:queue#early-failure"),
    );
    const journal = await readFile(
      join(directory, "logs", volume.eventLog!),
      "utf8",
    );
    assert.equal(journal.trim().split("\n").length, 4202);
    assert.equal(
      JSON.parse(journal.split("\n")[0]!).itemId,
      "node:queue#early-failure",
    );
    assert.equal(high, 1);
  } finally {
    await scheduler.dispose();
    await rm(directory, { recursive: true });
  }
});

test("native endpoint timeout and application exit return explicit failures", async () => {
  const { createServer } = await import("node:net");
  const { nativeCall } = await import("../server/native");
  const directory = await mkdtemp(join(tmpdir(), "tunnelde-disconnect-"));
  let close = false;
  const server = createServer((socket) => {
    socket.once("data", () => {
      if (close) socket.end();
    });
  });
  try {
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const path = join(directory, "endpoint.json");
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        address: `127.0.0.1:${(server.address() as { port: number }).port}`,
        token: "a".repeat(64),
        runId: "test",
      }),
    );
    await assert.rejects(
      nativeCall(path, "debug.describe", {}, 100),
      /timed out/,
    );
    close = true;
    await assert.rejects(
      nativeCall(path, "debug.describe"),
      /closed before responding|disconnected/,
    );
  } finally {
    server.close();
    await rm(directory, { recursive: true });
  }
});
