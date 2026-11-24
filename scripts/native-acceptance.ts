import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const origin = process.env.TUNNELDE_DEBUGGER_URL ?? "http://127.0.0.1:4760";
async function api(path: string, value?: object): Promise<any> {
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
const tree = await api("tests/discover", { runner: "native" });
const ids = process.argv.slice(2);
const run = await api("runs", {
  ids: ids.length ? ids : tree.map((item: { id: string }) => item.id),
});
console.log(`Native acceptance run ${run.id}`);
let sequence = 0;
process.on("SIGINT", () => {
  void api(`runs/${run.id}/cancel`, {});
});
for (;;) {
  const state = await api("state");
  const current = state.runs.find((item: { id: string }) => item.id === run.id);
  for (const event of current.events)
    if (event.sequence > sequence) {
      console.log(
        `${event.status ?? event.type}: ${event.text ?? event.itemId ?? event.artifact ?? ""}`,
      );
      sequence = event.sequence;
    }
  if (!["queued", "running"].includes(current.status)) {
    const directory = resolve(".tunnelde-debugger/reports");
    await mkdir(directory, { recursive: true });
    await writeFile(
      resolve(directory, `native-${run.id}.json`),
      JSON.stringify(await api("report"), null, 2),
    );
    console.log(
      `Result: ${current.status}. Manual visual approval remains separate.`,
    );
    process.exitCode = current.status === "passed" ? 0 : 1;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
