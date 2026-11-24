/** Exercise the same registered discovery/queue APIs as the sidebar. */
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { TestItem, TestRun, RunnerKind } from "../shared/protocol";
const origin = process.env.TUNNELDE_DEBUGGER_URL ?? "http://127.0.0.1:4760";
async function api<T>(path: string, value?: object): Promise<T> {
  const response = await fetch(
    `${origin}/api/${path}`,
    value
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        }
      : undefined,
  );
  const result = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(result));
  return result;
}
const chosen: string[] = [];
for (const kind of ["vitest", "node", "playwright", "rust"] as RunnerKind[]) {
  const items = await api<TestItem[]>("tests/discover", { runner: kind });
  const file =
    kind === "vitest"
      ? items.find((item) => item.file === "tests/store/hosts.test.ts")
      : kind === "node"
        ? items.find((item) => item.file?.endsWith("/platforms.test.mjs"))
        : items[0];
  const item =
    file?.children?.find((item) => !item.ignored && !item.unavailable) ?? file;
  if (!item) throw new Error(`No available ${kind} item`);
  chosen.push(item.id);
  console.log(`Selected ${item.id} (${items.length} roots)`);
}
const run = await api<TestRun>("runs", { ids: chosen });
console.log(`Run ${run.id}`);
let sequence = 0;
for (;;) {
  const state = await api<{ runs: TestRun[] }>("state");
  const current = state.runs.find((item) => item.id === run.id)!;
  for (const event of current.events)
    if (event.sequence > sequence) {
      console.log(
        `${event.status ?? event.type}: ${event.text ?? event.itemId}`,
      );
      sequence = event.sequence;
    }
  if (!["queued", "running"].includes(current.status)) {
    await mkdir(resolve(".tunnelde-debugger/reports"), { recursive: true });
    await writeFile(
      resolve(`.tunnelde-debugger/reports/runners-${run.id}.json`),
      JSON.stringify(current, null, 2),
    );
    console.log(`Result: ${current.status}`);
    process.exitCode = current.status === "passed" ? 0 : 1;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
