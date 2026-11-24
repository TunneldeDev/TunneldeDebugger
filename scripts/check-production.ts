import { resolve, join } from "node:path";
import { readFile } from "node:fs/promises";
import { runProcess } from "../server/process";
import { walk } from "../server/runners";
const target = resolve(
  process.argv[2] ??
    process.env.TUNNELDE_TARGET ??
    "../Tunnelde-debugger-target",
);
const build = await runProcess("pnpm", ["build"], {
  cwd: target,
  env: { VITE_TUNNELDE_DEBUGGER: "1" },
  onLine: console.log,
});
if (build.code !== 0) throw new Error("Target production build failed");
const markers = [
  "debugger_context",
  "__TUNNELDE_DEBUGGER_MOCK__",
  "debugger-fixture",
  "Synthetic scenario",
  "debugger://return",
];
for (const file of await walk(join(target, "dist/assets")))
  if (file.endsWith(".js")) {
    const text = await readFile(file, "utf8");
    for (const marker of markers)
      if (text.includes(marker))
        throw new Error(`Development marker ${marker} in ${file}`);
  }
console.log(
  "Production assets exclude debugger injection, even with the frontend flag set.",
);
