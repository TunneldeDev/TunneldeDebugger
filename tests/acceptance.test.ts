import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AcceptanceStore } from "../server/acceptance";
import { JsonStore } from "../server/storage";
import { DEFAULT_PARAMETERS, type AcceptanceRecord } from "../shared/protocol";
const makeRecord = (id: string): AcceptanceRecord => ({
  id,
  scenarioId: "hosts",
  target: "browser",
  parameters: DEFAULT_PARAMETERS,
  source: {
    path: "/test",
    revision: "abc",
    dirtyFingerprint: "def",
    protocol: 1,
  },
  status: "failed",
  note: "Issue",
  screenshots: ["example.png"],
  updatedAt: new Date().toISOString(),
});
test("acceptance edits, soft deletion and restoration survive restart with original source", async () => {
  const path = await mkdtemp(join(tmpdir(), "td-acceptance-"));
  try {
    const disk = new JsonStore<AcceptanceRecord[]>(
      join(path, "records.json"),
      [],
    );
    const store = new AcceptanceStore(disk);
    await store.initialize();
    const record = await store.save(makeRecord("one"));
    const edited = await store.save(
      { ...record, note: "Corrected", status: "blocked" },
      record.updatedAt,
    );
    assert.equal(store.list().length, 1);
    assert.deepEqual(edited.source, record.source);
    assert.notEqual(edited.updatedAt, record.updatedAt);
    await assert.rejects(
      store.save({ ...record, note: "Stale" }, record.updatedAt),
      /changed/,
    );
    await store.remove(edited.id, edited.updatedAt);
    assert.equal(store.list().length, 0);
    const restored = new AcceptanceStore(disk);
    await restored.initialize();
    assert.equal(restored.list().length, 0);
    assert.equal(restored.list(true)[0]?.note, "Corrected");
    await restored.restore(edited.id);
    assert.equal(restored.list()[0]?.note, "Corrected");
    assert.deepEqual(restored.list()[0]?.screenshots, ["example.png"]);
  } finally {
    await rm(path, { recursive: true, force: true });
  }
});
test("serialized acceptance writes do not lose simultaneous records; failed disk writes are not published", async () => {
  let bytes: AcceptanceRecord[] = [];
  let fail = false;
  const store = new AcceptanceStore({
    read: async () => structuredClone(bytes),
    write: async (next: AcceptanceRecord[]) => {
      if (fail) throw new Error("disk full");
      await new Promise((resolve) => setTimeout(resolve, 2));
      bytes = structuredClone(next);
    },
  } as JsonStore<AcceptanceRecord[]>);
  await store.initialize();
  await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      store.save(makeRecord(String(index))),
    ),
  );
  assert.equal(store.list().length, 20);
  assert.equal(bytes.length, 20);
  fail = true;
  const first = store.list()[0]!;
  await assert.rejects(store.remove(first.id, first.updatedAt), /disk full/);
  await assert.rejects(store.save(makeRecord("failed")), /disk full/);
  assert.equal(store.list().length, 20);
  fail = false;
  await store.save(makeRecord("recovered"));
  assert.equal(store.list().length, 21);
});
