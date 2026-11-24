import { spawn, type ChildProcess } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
export interface ProcessResult {
  code: number | null;
  output: string;
  cancelled: boolean;
}
export function stopTree(child: ChildProcess, force = false): void {
  if (!child.pid) return;
  if (process.platform === "win32") {
    spawn(
      "taskkill",
      ["/PID", String(child.pid), "/T", ...(force ? ["/F"] : [])],
      { windowsHide: true, stdio: "ignore" },
    );
  } else {
    try {
      process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  }
}
export async function runProcess(
  command: string,
  args: string[],
  options: {
    cwd: string;
    signal?: AbortSignal;
    env?: NodeJS.ProcessEnv;
    onLine?: (line: string) => void;
    onChild?: (child: ChildProcess) => void;
    timeout?: number;
  },
): Promise<ProcessResult> {
  if (options.signal?.aborted)
    return { code: null, output: "", cancelled: true };
  return new Promise((resolve, reject) => {
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      ...options.env,
      FORCE_COLOR: "0",
      NO_COLOR: "1",
    };
    delete environment.NODE_TEST_CONTEXT;
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: environment,
      detached: process.platform !== "win32",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    options.onChild?.(child);
    let output = "";
    let cancelled = false;
    let killTimer: NodeJS.Timeout | undefined;
    const abort = () => {
      cancelled = true;
      stopTree(child);
      killTimer = setTimeout(() => stopTree(child, true), 2000);
      killTimer.unref();
    };
    options.signal?.addEventListener("abort", abort, { once: true });
    const timeout = options.timeout
      ? setTimeout(abort, options.timeout)
      : undefined;
    const decoders = [new StringDecoder("utf8"), new StringDecoder("utf8")];
    const pending = ["", ""];
    const receive = (index: number, value: string) => {
      output = (output + value).slice(-4 * 1024 * 1024);
      pending[index] += value;
      let position: number;
      while ((position = pending[index]!.indexOf("\n")) >= 0) {
        options.onLine?.(pending[index]!.slice(0, position));
        pending[index] = pending[index]!.slice(position + 1);
      }
      if (pending[index]!.length > 256 * 1024) {
        options.onLine?.(pending[index]!.slice(0, 256 * 1024));
        pending[index] = "";
      }
    };
    child.stdout!.on("data", (chunk) => receive(0, decoders[0]!.write(chunk)));
    child.stderr!.on("data", (chunk) => receive(1, decoders[1]!.write(chunk)));
    const cleanup = () => {
      clearTimeout(timeout);
      clearTimeout(killTimer);
      options.signal?.removeEventListener("abort", abort);
    };
    child.on("error", (error) => {
      cleanup();
      reject(error);
    });
    child.on("close", (code) => {
      for (const i of [0, 1]) {
        receive(i, decoders[i]!.end());
        if (pending[i]) options.onLine?.(pending[i]!);
      }
      cleanup();
      resolve({ code, output, cancelled });
    });
    if (options.signal?.aborted) abort();
  });
}
