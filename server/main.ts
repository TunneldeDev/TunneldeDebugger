import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createServer as createViteServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { scenarios, scenarioById } from "../shared/scenarios";
import {
  validateParameters,
  type AcceptanceRecord,
  type RunnerKind,
  type TestItem,
  type TargetKind,
} from "../shared/protocol";
import { JsonStore, sourceIdentity } from "./storage";
import { Runner, flattenTests } from "./runners";
import { Scheduler } from "./scheduler";
import { NativeRunner } from "./native-runner";
import { NativeManager } from "./native";
const root = fileURLToPath(new URL("../", import.meta.url));
const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const target = resolve(
  argument("--target") ??
    process.env.TUNNELDE_TARGET ??
    join(root, "../Tunnelde-debugger-target"),
);
const data = resolve(
  argument("--data") ??
    process.env.TUNNELDE_DEBUGGER_DATA ??
    join(root, ".tunnelde-debugger"),
);
const port = Number(argument("--port") ?? process.env.PORT ?? 4760);
const origin = `http://127.0.0.1:${port}`;
const rendererOrigin = `http://127.0.0.1:${port + 1}`;
const nativeFrontend = `http://127.0.0.1:${port + 2}`;
await mkdir(data, { recursive: true, mode: 0o700 });
const clients = new Set<ServerResponse>();
let pendingBroadcast: NodeJS.Timeout | undefined;
function changed() {
  if (!pendingBroadcast)
    pendingBroadcast = setTimeout(() => {
      pendingBroadcast = undefined;
      for (const client of clients)
        client.write("event: changed\ndata: {}\n\n");
    }, 80);
}
const scheduler = new Scheduler(target, data, changed, (kind) =>
  kind === "native"
    ? new NativeRunner(native, ensureNativeFrontend)
    : new Runner(kind, target),
);
await scheduler.initialize();
const native = new NativeManager(target, data, nativeFrontend, changed);
const recordsStore = new JsonStore<AcceptanceRecord[]>(
  join(data, "acceptance.json"),
  [],
);
let records = await recordsStore.read();
interface ArtifactEvidence {
  scenarioId: string;
  target: TargetKind;
  parameters: unknown;
  source: Awaited<ReturnType<typeof sourceIdentity>>;
  generation?: number;
}
const artifactsStore = new JsonStore<Record<string, ArtifactEvidence>>(
  join(data, "artifacts.json"),
  {},
);
const artifacts = await artifactsStore.read();
const testTree = new Map<RunnerKind, TestItem[]>();
const discovering = new Set<RunnerKind>();
const browserReady = new Map<
  string,
  {
    scenarioId: string;
    parameters: unknown;
    source: Awaited<ReturnType<typeof sourceIdentity>>;
  }
>();
let frameServer: ViteDevServer | undefined;
let targetServer: ViteDevServer | undefined;
let targetError: string | undefined;
async function ensureNativeFrontend() {
  if (!targetServer) {
    targetServer = await createViteServer({
      root: target,
      cacheDir: join(data, "vite-native"),
      configFile: join(target, "vite.config.ts"),
      define: { "import.meta.env.VITE_TUNNELDE_DEBUGGER": JSON.stringify("1") },
      server: {
        host: "127.0.0.1",
        port: port + 2,
        strictPort: true,
        hmr: { host: "127.0.0.1", port: port + 2 },
      },
    });
    await targetServer.listen();
  }
}

try {
  await stat(join(target, "src/debugger/index.tsx"));
  frameServer = await createViteServer({
    root,
    cacheDir: join(data, "vite-renderer"),
    optimizeDeps: { entries: ["renderer.html"] },
    configFile: false,
    plugins: [react()],
    define: { "import.meta.env.VITE_TUNNELDE_DEBUGGER": JSON.stringify("1") },
    resolve: {
      alias: [
        {
          find: "@tunnelde-target",
          replacement: join(target, "src/debugger/index.tsx"),
        },
        { find: "@", replacement: join(target, "src") },
      ],
      dedupe: ["react", "react-dom"],
    },
    server: {
      host: "127.0.0.1",
      port: port + 1,
      strictPort: true,
      fs: { allow: [root, target] },
    },
  });
  await frameServer.listen();
} catch (error) {
  targetError = String(error);
}
const vite = await createViteServer({
  root,
  configFile: join(root, "vite.config.ts"),
  server: { middlewareMode: true, hmr: { port: port + 3 } },
  appType: "spa",
});
async function body(
  request: IncomingMessage,
): Promise<Record<string, unknown>> {
  let bytes = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 1024 * 1024) throw new Error("Request body exceeds 1 MiB");
    chunks.push(chunk);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!value || Array.isArray(value) || typeof value !== "object")
    throw new Error("Expected object");
  return value;
}
function json(response: ServerResponse, value: unknown, status = 200) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(value));
}
function checkedRequest(request: IncomingMessage) {
  if (
    !["127.0.0.1", "::ffff:127.0.0.1", "::1"].includes(
      request.socket.remoteAddress ?? "",
    )
  )
    throw new Error("Loopback only");
  if (
    request.headers.host !== `127.0.0.1:${port}` &&
    request.headers.host !== `localhost:${port}`
  )
    throw new Error("Unexpected Host");
  if (
    request.headers.origin &&
    request.headers.origin !== origin &&
    request.headers.origin !== `http://localhost:${port}`
  )
    throw new Error("Cross-origin access rejected");
  if (
    request.method !== "GET" &&
    !request.headers["content-type"]?.startsWith("application/json")
  )
    throw new Error("JSON content type required");
}
const server = createHttpServer(async (request, response) => {
  const url = new URL(request.url ?? "/", origin);
  if (
    !url.pathname.startsWith("/api/") &&
    !url.pathname.startsWith("/artifacts/")
  ) {
    vite.middlewares(request, response, () => {
      response.writeHead(404);
      response.end();
    });
    return;
  }
  try {
    checkedRequest(request);
    const readOnly =
      [
        "/api/events",
        "/api/config",
        "/api/scenarios",
        "/api/state",
        "/api/tests",
        "/api/report",
      ].includes(url.pathname) ||
      url.pathname.startsWith("/artifacts/") ||
      /^\/api\/runs\/[^/]+\/events$/.test(url.pathname);
    if (request.method !== (readOnly ? "GET" : "POST")) {
      json(response, { error: "Method not allowed" }, 405);
      return;
    }
    if (url.pathname === "/api/events") {
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      response.write(": connected\n\n");
      clients.add(response);
      request.on("close", () => clients.delete(response));
      return;
    }
    if (url.pathname === "/api/config") {
      json(response, {
        source: await sourceIdentity(target),
        rendererOrigin,
        targetError,
        protocol: 1,
        platform: process.platform,
      });
      return;
    }
    if (url.pathname === "/api/scenarios") {
      json(response, scenarios);
      return;
    }
    if (url.pathname === "/api/state") {
      json(response, {
        runs: scheduler.runs.slice(-100),
        records,
        native: native.state,
        nativeLogs: native.logs,
      });
      return;
    }
    if (/^\/api\/runs\/[^/]+\/events$/.test(url.pathname)) {
      const run = scheduler.runs.find(
        (run) => run.id === url.pathname.split("/")[3],
      );
      if (!run?.eventLog || basename(run.eventLog) !== run.eventLog)
        throw new Error("No full event journal for this run");
      const bytes = await readFile(join(data, "logs", run.eventLog));
      response.writeHead(200, {
        "Content-Type": "application/x-ndjson",
        "Content-Disposition": `attachment; filename="${run.id}.jsonl"`,
      });
      response.end(bytes);
      return;
    }
    if (url.pathname === "/api/tests" && request.method === "GET") {
      for (const run of scheduler.runs)
        for (const event of Object.values(
          run.results ??
            Object.fromEntries(
              run.events.map((event) => [event.sequence, event]),
            ),
        )) {
          if (event.type !== "case" || !event.itemId?.includes("#")) continue;
          const [parentId, ...parts] = event.itemId.split("#");
          const kind = event.itemId.split(":")[0] as RunnerKind;
          const parent = flattenTests(testTree.get(kind) ?? []).find(
            (item) => item.id === parentId,
          );
          if (
            parent &&
            !parent.children?.some((child) => child.id === event.itemId)
          ) {
            parent.children ??= [];
            parent.children.push({
              id: event.itemId,
              runner: kind,
              label: parts.join("#"),
              name: parts.join("#"),
              file: parent.file,
              target: parent.target,
            });
          }
        }
      json(response, Object.fromEntries(testTree));
      return;
    }
    if (url.pathname === "/api/tests/discover") {
      const input = await body(request);
      const kind = input.runner as RunnerKind;
      if (!["vitest", "node", "rust", "playwright", "native"].includes(kind))
        throw new Error("Unknown test runner");
      if (discovering.has(kind)) throw new Error("Discovery already running");
      discovering.add(kind);
      try {
        const items = await (
          kind === "native"
            ? new NativeRunner(native, ensureNativeFrontend)
            : new Runner(kind, target)
        ).discover();
        testTree.set(kind, items);
        json(response, items);
        changed();
      } finally {
        discovering.delete(kind);
      }
      return;
    }
    if (url.pathname === "/api/runs" && request.method === "POST") {
      const input = await body(request);
      if (
        !Array.isArray(input.ids) ||
        !input.ids.every((id) => typeof id === "string")
      )
        throw new Error("Expected test IDs");
      const available = flattenTests([...testTree.values()].flat());
      const selected = input.ids.map((id) => {
        const item = available.find((item) => item.id === id);
        if (!item) throw new Error(`Unknown test ID: ${id}`);
        return item;
      });
      json(response, await scheduler.enqueue(selected));
      return;
    }
    if (/^\/api\/runs\/[^/]+\/cancel$/.test(url.pathname)) {
      await body(request);
      await scheduler.cancel(url.pathname.split("/")[3]!);
      json(response, { ok: true });
      return;
    }
    if (url.pathname === "/api/browser/ready") {
      const input = await body(request);
      const scene = scenarioById(String(input.scenarioId));
      const parameters = validateParameters(input.parameters);
      const ticket = randomUUID();
      browserReady.set(ticket, {
        scenarioId: scene.id,
        parameters,
        source: await sourceIdentity(target),
      });
      if (browserReady.size > 300)
        browserReady.delete(browserReady.keys().next().value!);
      json(response, { ticket });
      return;
    }
    if (url.pathname === "/api/acceptance" && request.method === "POST") {
      const input = await body(request);
      const scenario = scenarioById(String(input.scenarioId));
      const parameters = validateParameters(input.parameters);
      if (
        !scenario.targets.includes(input.target as TargetKind) ||
        !["pending", "passed", "failed", "blocked"].includes(
          String(input.status),
        )
      )
        throw new Error("Invalid acceptance result");
      if (
        input.target !== "browser" &&
        (native.state.state !== "ready" ||
          native.state.scenarioId !== scenario.id ||
          native.state.mode !== input.target ||
          JSON.stringify(native.state.parameters) !==
            JSON.stringify(parameters) ||
          input.generation !== native.state.generation)
      )
        throw new Error("Acceptance does not match the ready native scenario");
      const browserEvidence = browserReady.get(String(input.ticket));
      if (
        input.target === "browser" &&
        input.status === "passed" &&
        (!browserEvidence ||
          browserEvidence.scenarioId !== scenario.id ||
          JSON.stringify(browserEvidence.parameters) !==
            JSON.stringify(parameters))
      )
        throw new Error(
          "Browser scene has no matching readiness acknowledgement",
        );
      if (input.status === "passed") {
        const source =
          input.target === "browser"
            ? browserEvidence!.source
            : native.state.source!;
        const currentSource = await sourceIdentity(target);
        if (
          currentSource.revision !== source.revision ||
          currentSource.dirtyFingerprint !== source.dirtyFingerprint
        )
          throw new Error(
            "Target source changed; reload the scenario before acceptance",
          );
      }
      const screenshots = Array.isArray(input.screenshots)
        ? input.screenshots
        : [];
      if (
        screenshots.length > 20 ||
        screenshots.some((name) => {
          if (typeof name !== "string" || basename(name) !== name) return true;
          const evidence = artifacts[name];
          const source =
            input.target === "browser"
              ? browserEvidence?.source
              : native.state.source;
          return (
            !evidence ||
            !source ||
            evidence.scenarioId !== scenario.id ||
            evidence.target !== input.target ||
            JSON.stringify(evidence.parameters) !==
              JSON.stringify(parameters) ||
            evidence.source.revision !== source.revision ||
            evidence.source.dirtyFingerprint !== source.dirtyFingerprint ||
            (input.target !== "browser" &&
              evidence.generation !== native.state.generation)
          );
        })
      )
        throw new Error(
          "Screenshot evidence does not belong to this scenario, parameters and source",
        );
      await Promise.all(
        screenshots.map((name) => stat(join(data, "artifacts", String(name)))),
      );
      const record: AcceptanceRecord = {
        id: randomUUID(),
        scenarioId: scenario.id,
        target: input.target as TargetKind,
        parameters,
        source:
          input.target === "browser"
            ? (browserEvidence?.source ?? (await sourceIdentity(target)))
            : native.state.source!,
        checklist: Array.isArray(input.checklist)
          ? input.checklist.filter(
              (value): value is string =>
                typeof value === "string" && scenario.checklist.includes(value),
            )
          : [],
        status: input.status as AcceptanceRecord["status"],
        note: String(input.note ?? "").slice(0, 20000),
        screenshots: Array.isArray(input.screenshots)
          ? input.screenshots
              .filter(
                (name): name is string =>
                  typeof name === "string" && basename(name) === name,
              )
              .slice(0, 20)
          : [],
        updatedAt: new Date().toISOString(),
        ...(input.target !== "browser"
          ? { generation: native.state.generation }
          : {}),
      };
      records.push(record);
      await recordsStore.write(records);
      json(response, record);
      changed();
      return;
    }
    if (url.pathname === "/api/report") {
      json(response, {
        version: 1,
        generatedAt: new Date().toISOString(),
        source: await sourceIdentity(target),
        coverage: scenarios,
        records,
        runs: scheduler.runs,
        native: native.state,
      });
      return;
    }
    if (url.pathname.startsWith("/api/native/") && scheduler.nativeBusy)
      throw new Error(
        "Native target is owned by a scheduled test; cancel it before manual operations",
      );
    if (url.pathname === "/api/native/start") {
      const input = await body(request);
      const scenario = scenarioById(String(input.scenarioId));
      const parameters = validateParameters(input.parameters);
      const mode = input.mode as TargetKind;
      if (
        !["native-mock", "native-service"].includes(mode) ||
        !scenario.targets.includes(mode)
      )
        throw new Error("Unsupported native scenario");
      await ensureNativeFrontend();
      json(response, await native.start(mode, scenario, parameters));
      return;
    }
    if (url.pathname === "/api/native/apply") {
      const input = await body(request);
      const scenario = scenarioById(String(input.scenarioId));
      if (native.state.mode === "native-service")
        throw new Error(
          "Real service scenes require restart with a fresh profile",
        );
      json(
        response,
        await native.apply(scenario, validateParameters(input.parameters)),
      );
      return;
    }
    if (url.pathname === "/api/native/stop") {
      await body(request);
      await native.stop();
      json(response, { ok: true });
      return;
    }
    if (url.pathname === "/api/native/action") {
      const input = await body(request);
      if (
        ![
          "debug.snapshot",
          "debug.windows",
          "debug.present",
          "debug.check",
          "debug.events",
        ].includes(String(input.method))
      )
        throw new Error("Unregistered native action");
      json(
        response,
        ["debug.present", "debug.check"].includes(String(input.method))
          ? await native.action(
              input.method as "debug.present" | "debug.check",
              (input.params ?? {}) as Record<string, unknown>,
            )
          : await native.call(String(input.method), input.params ?? {}),
      );
      return;
    }
    if (url.pathname === "/api/native/capture") {
      await body(request);
      const artifact = await native.capture();
      artifacts[artifact] = {
        scenarioId: native.state.scenarioId!,
        target: native.state.mode!,
        parameters: native.state.parameters,
        source: native.state.source!,
        generation: native.state.generation,
      };
      await artifactsStore.write(artifacts);
      json(response, { artifact });
      return;
    }
    if (url.pathname === "/api/capture") {
      const input = await body(request);
      const scenario = scenarioById(String(input.scenarioId));
      const parameters = validateParameters(input.parameters);
      const { chromium } = await import("@playwright/test");
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({
          viewport: { width: parameters.width, height: parameters.height },
        });
        await page.goto(`${origin}/?scene=${scenario.id}`);
        await page.evaluate(
          (params) =>
            window.dispatchEvent(
              new CustomEvent("debugger:parameters", { detail: params }),
            ),
          parameters,
        );
        await page.getByTestId("scene-ready").waitFor({ timeout: 60000 });
        const name = `browser-${scenario.id}-${Date.now()}.png`;
        await mkdir(join(data, "artifacts"), { recursive: true });
        await page
          .frameLocator("iframe")
          .locator("body")
          .screenshot({ path: join(data, "artifacts", name) });
        artifacts[name] = {
          scenarioId: scenario.id,
          target: "browser",
          parameters,
          source: await sourceIdentity(target),
        };
        await artifactsStore.write(artifacts);
        json(response, { artifact: name });
      } finally {
        await browser.close();
      }
      return;
    }
    if (url.pathname.startsWith("/artifacts/")) {
      const name = url.pathname.slice(11);
      if (basename(name) !== name || !name.endsWith(".png"))
        throw new Error("Invalid artifact");
      response.writeHead(200, {
        "Content-Type": "image/png",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(await readFile(join(data, "artifacts", name)));
      return;
    }
    json(response, { error: "Not found" }, 404);
  } catch (error) {
    json(
      response,
      { error: error instanceof Error ? error.message : String(error) },
      400,
    );
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`TunneldeDebugger ${origin}\nTarget: ${target}`),
);
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  await scheduler.dispose();
  await native.stop();
  for (const client of clients) client.end();
  await Promise.all([
    vite.close(),
    frameServer?.close(),
    targetServer?.close(),
  ]);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
