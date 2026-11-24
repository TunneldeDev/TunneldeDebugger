export default async function* debuggerReporter(source) {
  const parents = new Map();
  for await (const event of source) {
    const row = event.data;
    if (event.type === "test:enqueue")
      parents.set(`${row.file}:${row.testId}`, {
        name: row.name,
        parentId: row.parentId,
      });
    if (
      (event.type === "test:pass" || event.type === "test:fail") &&
      (row.details?.type === "suite" || row.name === row.file)
    ) {
      yield `@@TDEBUG@@${JSON.stringify({ type: "log", text: `Suite ${row.name}: ${event.type === "test:pass" ? "passed" : "failed"}` })}\n`;
      continue;
    }
    if (event.type === "test:pass" || event.type === "test:fail") {
      // Node's --test-name-pattern matches the complete ancestor path.
      const names = [row.name];
      let parentId = row.parentId;
      while (parentId) {
        const parent = parents.get(`${row.file}:${parentId}`);
        if (!parent) break;
        names.unshift(parent.name);
        parentId = parent.parentId;
      }
      const name = names.join(" ");
      yield `@@TDEBUG@@${JSON.stringify({ text: name, status: row.skip || row.todo ? "skipped" : event.type === "test:pass" ? "passed" : "failed", duration: row.details?.duration_ms })}\n`;
    }
    if (event.type === "test:fail")
      yield `@@TDEBUG@@${JSON.stringify({ type: "log", text: row.details?.error?.stack ?? String(row.details?.error ?? "Test failed") })}\n`;
    if (
      event.type === "test:stdout" ||
      event.type === "test:stderr" ||
      event.type === "test:diagnostic"
    )
      yield `@@TDEBUG@@${JSON.stringify({ type: "log", text: row.message })}\n`;
  }
}
