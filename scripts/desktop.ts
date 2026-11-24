import spawn from "cross-spawn";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { runProcess, stopTree } from "../server/process";
import { settingsStore } from "../server/settings";
const root = fileURLToPath(new URL("../", import.meta.url));
const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const data = resolve(
  argument("--data") ??
    process.env.TUNNELDE_DEBUGGER_DATA ??
    join(root, ".tunnelde-debugger"),
);
const settings = await settingsStore(
  data,
  join(root, "../Tunnelde-debugger-target"),
).read();
const port = Number(
  argument("--port") ?? process.env.PORT ?? settings.servicePort,
);
if (!Number.isInteger(port) || port < 1024 || port > 65532)
  throw new Error("Invalid debugger port");
const url = `http://127.0.0.1:${port}`;
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
    const response = await fetch(`${url}/api/config`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return false;
    const config = await response.json();
    if (config.workspace !== root)
      throw new Error("Port belongs to another workspace");
    return config;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Port belongs to another workspace"
    )
      throw error;
    return false;
  }
}
try {
  const existing = await available();
  if (
    existing &&
    argument("--target") &&
    existing.source.path !== resolve(argument("--target")!)
  )
    throw new Error(
      "Existing service uses another project. Change Project settings or choose another --port.",
    );
  if (!existing) {
    service = spawn("pnpm", ["dev", ...process.argv.slice(2)], {
      cwd: root,
      stdio: "inherit",
      detached: process.platform !== "win32",
    });
    let launchError: Error | undefined;
    service.on("error", (error) => {
      launchError = error;
    });
    const deadline = Date.now() + 60000;
    while (!(await available())) {
      if (launchError) throw launchError;
      if (Date.now() > deadline || service.exitCode !== null)
        throw new Error("Local debugger service failed to start");
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  await mkdir(data, { recursive: true });
  const config = join(data, `desktop-${port}.json`);
  const csp = `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' ${url} ws://127.0.0.1:${port + 3}; frame-src http://127.0.0.1:${port + 1}; img-src 'self' data: blob: ${url}; style-src 'self' 'unsafe-inline'`;
  await writeFile(
    config,
    JSON.stringify({
      build: { devUrl: url },
      app: { security: { devCsp: csp } },
    }),
    { mode: 0o600 },
  );
  const result = await runProcess(
    "pnpm",
    ["exec", "tauri", "dev", "--no-watch", "--config", config],
    { cwd: root, signal: controller.signal, color: true, onLine: console.log },
  );
  process.exitCode = result.code ?? 1;
} finally {
  cleanup();
}
