import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { stat, readFile } from "node:fs/promises";
import { runProcess } from "../server/process";
const root = fileURLToPath(new URL("../", import.meta.url));
const source = resolve(process.argv[2] ?? join(root, "../Tunnelde"));
const target = resolve(
  process.argv[3] ?? join(root, "../Tunnelde-debugger-target"),
);
async function command(cwd: string, cmd: string, args: string[]) {
  const result = await runProcess(cmd, args, { cwd, onLine: console.log });
  if (result.code !== 0) throw new Error(`${cmd} failed (${result.code})`);
}
let exists = false;
try {
  await stat(target);
  exists = true;
} catch {}
if (exists) {
  await stat(join(target, "src/debugger/index.tsx"));
  console.log(`Reusing existing adapter checkout: ${target}`);
} else {
  await command(source, "git", ["fetch", "origin", "dev"]);
  const revision = JSON.parse(
    await readFile(join(root, "integration/base.json"), "utf8"),
  ).revision;
  await command(source, "git", [
    "worktree",
    "add",
    "--detach",
    target,
    revision,
  ]);
  await command(target, "git", [
    "apply",
    "--check",
    join(root, "integration/tunnelde.patch"),
  ]);
  await command(target, "git", [
    "apply",
    join(root, "integration/tunnelde.patch"),
  ]);
  await command(target, "pnpm", ["install", "--frozen-lockfile"]);
}
console.log(`Run pnpm dev --target ${target}`);
