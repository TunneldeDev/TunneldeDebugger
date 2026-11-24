import { randomUUID } from "node:crypto";
import { StringDecoder } from "node:string_decoder";
import { connect } from "node:net";
import { mkdir, readFile, writeFile, stat, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ChildProcess } from "node:child_process";
import type {
  NativeState,
  ScenarioDefinition,
  ScenarioParameters,
  TargetKind,
} from "../shared/protocol";
import { sourceIdentity } from "./storage";
import { runProcess, stopTree } from "./process";
export async function nativeCall(
  endpointPath: string,
  method: string,
  params: unknown = {},
  timeoutMs = 15000,
): Promise<unknown> {
  const endpoint = JSON.parse(await readFile(endpointPath, "utf8")) as {
    version: number;
    address: string;
    token: string;
    runId: string;
  };
  const match = /^127\.0\.0\.1:(\d+)$/.exec(endpoint.address);
  if (
    endpoint.version !== 1 ||
    !match ||
    !/^[a-f0-9]{64}$/.test(endpoint.token)
  )
    throw new Error("Invalid debugger endpoint");
  const id = randomUUID();
  return new Promise((resolveResult, reject) => {
    let buffer = "";
    const decoder = new StringDecoder("utf8");
    let settled = false;
    const socket = connect({ host: "127.0.0.1", port: Number(match[1]) });
    const finish = (error?: Error, result?: unknown) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolveResult(result);
    };
    socket.setTimeout(timeoutMs, () =>
      finish(new Error("Native debug request timed out")),
    );
    socket.on("error", (error) => finish(error));
    socket.on("connect", () =>
      socket.write(
        JSON.stringify({
          version: 1,
          id,
          token: endpoint.token,
          runId: endpoint.runId,
          method,
          params,
        }) + "\n",
      ),
    );
    socket.on("data", (bytes) => {
      buffer += decoder.write(bytes);
      if (buffer.length > 4 * 1024 * 1024)
        return finish(new Error("Native response exceeds limit"));
      if (!buffer.includes("\n")) return;
      try {
        const response = JSON.parse(buffer.slice(0, buffer.indexOf("\n")));
        if (response.id !== id || response.version !== 1)
          throw new Error("Mismatched native response");
        if (response.error)
          throw new Error(`${response.error.code}: ${response.error.message}`);
        finish(undefined, response.result);
      } catch (error) {
        finish(error as Error);
      }
    });
    socket.on("end", () => {
      if (!buffer.includes("\n"))
        finish(new Error("Native endpoint closed before responding"));
    });
    socket.on("close", () => {
      if (!settled) finish(new Error("Native endpoint disconnected"));
    });
  });
}
export class NativeManager {
  state: NativeState = { state: "stopped", generation: 0 };
  logs: string[] = [];
  private child?: ChildProcess;
  private endpoint?: string;
  private starting?: AbortController;
  private operation = false;
  private activeWindow = "main";
  constructor(
    private target: string,
    private data: string,
    private frontend: string,
    private changed: () => void,
  ) {}
  private log = (line: string) => {
    this.logs.push(line);
    if (this.logs.length > 1500) this.logs.shift();
    this.changed();
  };
  async describe() {
    return {
      protocol: 1,
      targets: ["native-mock", "native-service"] as TargetKind[],
      source: await sourceIdentity(this.target),
    };
  }
  async start(
    mode: TargetKind,
    scenario: ScenarioDefinition,
    parameters: ScenarioParameters,
  ) {
    if (!scenario.presets.includes(parameters.preset))
      throw new Error("Unsupported scenario preset");
    if (mode === "browser" || !scenario.targets.includes(mode))
      throw new Error("Unsupported native target");
    if (
      mode === "native-service" &&
      !["normal", "empty", "boundary"].includes(parameters.preset)
    )
      throw new Error(
        "Real services do not simulate failures/loading/disabled states",
      );
    if (
      mode === "native-service" &&
      ["terminal", "files"].includes(scenario.id) &&
      (parameters.preset === "empty" || parameters.count === 0)
    )
      throw new Error(
        "SSH/SFTP requires a host; empty real fixture is not applicable",
      );
    if (this.operation)
      throw new Error("A native lifecycle operation is already running");
    this.operation = true;
    try {
      await this.stop();
      const runId = randomUUID();
      const profile = join(this.data, "instances", runId);
      await mkdir(profile, { recursive: true, mode: 0o700 });
      await mkdir(join(profile, "files"), { mode: 0o700 });
      await writeFile(
        join(profile, "files", "README.md"),
        "# Tunnelde 原生验收\n\n这是真实隔离文件，可在生产编辑器保存。\n",
        { mode: 0o600 },
      );
      await writeFile(
        join(profile, ".debugger-profile"),
        JSON.stringify({ runId, version: 1 }),
        { mode: 0o600 },
      );
      const config = join(profile, "tauri.debugger.json");
      await writeFile(
        config,
        JSON.stringify({
          productName: "Tunnelde Debug Target",
          identifier: "dev.tunnelde.debugtarget",
          build: { beforeDevCommand: null, devUrl: this.frontend },
          app: {
            security: {
              devCsp: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' tunnelde-ui: http://tunnelde-ui.localhost; style-src 'self' 'unsafe-inline'; img-src 'self' data: asset: http://asset.localhost preview: http://preview.localhost; font-src 'self' data: tunnelde-font: http://tunnelde-font.localhost; connect-src 'self' ipc: http://ipc.localhost ${this.frontend} ${this.frontend.replace("http:", "ws:")}; media-src 'self' preview: http://preview.localhost; worker-src 'self' blob:; object-src 'none'`,
            },
          },
        }),
        { mode: 0o600 },
      );
      this.endpoint = join(profile, "debugger.json");
      this.state = {
        state: "starting",
        generation: 0,
        profile,
        runId,
        mode,
        parameters,
        source: await sourceIdentity(this.target),
      };
      this.logs = [];
      this.changed();
      this.starting = new AbortController();
      void runProcess(
        "pnpm",
        [
          "exec",
          "tauri",
          "dev",
          "--features",
          "debugger",
          "--no-watch",
          "--config",
          config,
        ],
        {
          cwd: this.target,
          signal: this.starting.signal,
          env: {
            TUNNELDE_DATA_DIR: profile,
            TUNNELDE_PLUGINS_DIR: join(profile, "plugins"),
            TUNNELDE_DEBUGGER_ACTIVE: "1",
            TUNNELDE_DEBUGGER_RUN_ID: runId,
            TUNNELDE_DEBUGGER_MODE: mode,
            VITE_TUNNELDE_DEBUGGER: "1",
          },
          onChild: (child) => {
            this.child = child;
            this.state.pid = child.pid;
          },
          onLine: this.log,
        },
      )
        .then((result) => {
          if (this.state.runId === runId && this.state.state !== "stopped") {
            this.state.state = result.cancelled ? "stopped" : "failed";
            this.state.error = result.cancelled
              ? undefined
              : `Target exited (${result.code})`;
            this.changed();
          }
        })
        .catch((error) => {
          if (this.state.runId === runId) {
            this.state.state = "failed";
            this.state.error = String(error);
            this.changed();
          }
        });
      // Compilation is asynchronous. The UI remains responsive while polling status.
      void this.waitForEndpoint(runId, scenario, parameters);
      return this.state;
    } finally {
      this.operation = false;
    }
  }
  private async waitForEndpoint(
    runId: string,
    scenario: ScenarioDefinition,
    parameters: ScenarioParameters,
  ) {
    const deadline = Date.now() + 15 * 60 * 1000;
    try {
      while (this.state.runId === runId && this.state.state === "starting") {
        if (Date.now() > deadline)
          throw new Error("Native compilation/startup exceeded 15 minutes");
        try {
          await stat(this.endpoint!);
          break;
        } catch {
          await new Promise((resolveWait) => setTimeout(resolveWait, 500));
        }
      }
      if (this.state.runId !== runId || this.state.state !== "starting") return;
      this.state.capabilities = await nativeCall(
        this.endpoint!,
        "debug.describe",
      );
      await this.apply(scenario, parameters);
    } catch (error) {
      if (this.state.runId === runId) {
        this.state.state = "failed";
        this.state.error = String(error);
        this.changed();
      }
    }
  }
  async apply(scenario: ScenarioDefinition, parameters: ScenarioParameters) {
    if (!scenario.presets.includes(parameters.preset))
      throw new Error("Unsupported scenario preset");
    if (!this.endpoint || !["ready", "starting"].includes(this.state.state))
      throw new Error("No available native instance");
    if (!scenario.targets.includes(this.state.mode!))
      throw new Error("Unsupported scenario target");
    if (this.state.state === "applying")
      throw new Error("Native scene is already applying");
    this.activeWindow = "main";
    const runId = this.state.runId;
    const endpoint = this.endpoint;
    const generation = this.state.generation + 1;
    this.state = {
      ...this.state,
      state: "applying",
      generation,
      scenarioId: scenario.id,
      parameters,
      error: undefined,
    };
    this.changed();
    try {
      await nativeCall(endpoint, "debug.apply", {
        generation,
        scenarioId: scenario.id,
        parameters,
      });
      const deadline = Date.now() + 30000;
      while (
        this.state.runId === runId &&
        this.state.generation === generation &&
        this.state.state === "applying"
      ) {
        const status = (await nativeCall(endpoint, "debug.snapshot")) as {
          generation: number;
          ready: boolean;
          error?: string;
        };
        if (status.generation === generation && status.error)
          throw new Error(status.error);
        if (status.generation === generation && status.ready) {
          this.state.state = "ready";
          this.changed();
          return this.state;
        }
        if (Date.now() > deadline)
          throw new Error(
            "The native scene did not acknowledge actual rendering",
          );
        await new Promise((resolveWait) => setTimeout(resolveWait, 150));
      }
      throw new Error("Native scene superseded");
    } catch (error) {
      if (this.state.runId === runId && this.state.generation === generation) {
        this.state.state = "failed";
        this.state.error = String(error);
        this.changed();
      }
      throw error;
    }
  }
  async call(method: string, params: unknown = {}) {
    if (!this.endpoint || this.state.state !== "ready")
      throw new Error("Native instance is not ready");
    return nativeCall(this.endpoint, method, params);
  }
  async waitReady(signal?: AbortSignal) {
    const deadline = Date.now() + 15 * 60 * 1000;
    while (this.state.state !== "ready") {
      if (signal?.aborted) {
        await this.stop();
        throw new Error("Native task cancelled");
      }
      if (this.state.state === "failed" || this.state.state === "stopped")
        throw new Error(this.state.error ?? "Native target stopped");
      if (Date.now() > deadline) throw new Error("Native startup timed out");
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  async action(
    method: "debug.present" | "debug.check",
    params: Record<string, unknown> = {},
  ) {
    const runId = this.state.runId;
    const generation = this.state.generation;
    await this.call(method, { ...params, generation });
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      if (this.state.runId !== runId || this.state.generation !== generation)
        throw new Error("Native action superseded");
      const status = (await this.call("debug.snapshot")) as {
        result?: { ok: boolean; error?: string; owner?: { windowId: string } };
      };
      if (status.result) {
        if (!status.result.ok)
          throw new Error(status.result.error ?? "Native action failed");
        if (status.result.owner)
          this.activeWindow = status.result.owner.windowId;
        return status.result;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error("Native action readiness timed out");
  }
  async verifyProtocol() {
    if (!this.endpoint) throw new Error("No endpoint");
    const endpoint = JSON.parse(await readFile(this.endpoint, "utf8"));
    const badEndpoint = join(this.data, `invalid-token-${randomUUID()}.json`);
    await writeFile(
      badEndpoint,
      JSON.stringify({ ...endpoint, token: "0".repeat(64) }),
      { mode: 0o600 },
    );
    try {
      try {
        await nativeCall(badEndpoint, "debug.describe");
        throw new Error("Wrong token accepted");
      } catch (error) {
        if (!String(error).includes("unauthorized")) throw error;
      }
    } finally {
      await rm(badEndpoint, { force: true });
    }
    for (const [method, params, expected] of [
      [
        "debug.apply",
        {
          generation: this.state.generation,
          scenarioId: this.state.scenarioId,
          parameters: this.state.parameters,
        },
        "stale",
      ],
      [
        "debug.apply",
        {
          generation: this.state.generation + 1,
          scenarioId: "not-registered",
          parameters: this.state.parameters,
        },
        "unregistered",
      ],
      ["eval", {}, "unknown"],
    ] as const) {
      try {
        await this.call(method, params);
        throw new Error(`Rejected operation accepted: ${method}`);
      } catch (error) {
        if (!String(error).includes(expected)) throw error;
      }
    }
    return [
      "wrong token rejected",
      "stale generation rejected",
      "unknown scene rejected",
      "arbitrary command rejected",
    ];
  }
  async capture(placement?: "main" | "native") {
    if (process.platform !== "darwin")
      throw new Error(
        "Native screenshot capture is currently implemented on macOS only",
      );
    const info = (await this.call("debug.windows")) as {
      windows: Array<{ label: string; number: number }>;
    };
    const window = info.windows.find((item) =>
      placement
        ? placement === "main"
          ? item.label === "main"
          : item.label !== "main"
        : item.label === this.activeWindow,
    );
    if (!window?.number)
      throw new Error("Native window identifier unavailable");
    await this.call("debug.focus", { label: window.label });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const name = `native-${this.state.runId}-${this.state.generation}-${Date.now()}.png`;
    const path = join(this.data, "artifacts", name);
    await mkdir(join(this.data, "artifacts"), { recursive: true });
    const result = await runProcess(
      "/usr/sbin/screencapture",
      ["-x", "-o", "-l", String(window.number), path],
      { cwd: this.target, timeout: 15000 },
    );
    if (result.code !== 0 || (await stat(path)).size === 0)
      throw new Error(`Screenshot capture failed: ${result.output}`);
    return name;
  }
  async stop() {
    this.starting?.abort();
    const child = this.child;
    if (child) stopTree(child);
    this.child = undefined;
    this.starting = undefined;
    this.endpoint = undefined;
    this.state = { state: "stopped", generation: this.state.generation + 1 };
    this.changed();
    if (child && child.exitCode === null)
      await new Promise<void>((resolveWait) => {
        const timer = setTimeout(() => {
          stopTree(child, true);
          resolveWait();
        }, 2200);
        child.once("close", () => {
          clearTimeout(timer);
          resolveWait();
        });
      });
  }
}
