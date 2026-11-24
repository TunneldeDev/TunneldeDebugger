import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runProcess, stopTree } from "../server/process";
const root = fileURLToPath(new URL("../", import.meta.url));
let service: ReturnType<typeof spawn> | undefined;
const controller = new AbortController();
const cleanup = () => {
  controller.abort();
  if (service) stopTree(service);
};
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
async function available() {
  try {
    return (await fetch("http://127.0.0.1:4760/api/config")).ok;
  } catch {
    return false;
  }
}
try {
  if (!(await available())) {
    service = spawn("pnpm", ["dev", ...process.argv.slice(2)], {
      cwd: root,
      stdio: "inherit",
      detached: process.platform !== "win32",
    });
    const deadline = Date.now() + 60000;
    while (!(await available())) {
      if (Date.now() > deadline || service.exitCode !== null)
        throw new Error("Local debugger service failed to start");
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  const result = await runProcess(
    "pnpm",
    ["exec", "tauri", "dev", "--no-watch"],
    { cwd: root, signal: controller.signal, onLine: console.log },
  );
  process.exitCode = result.code ?? 1;
} finally {
  cleanup();
}
