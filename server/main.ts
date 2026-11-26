import { settingsStore, validateSettings, inspectProject } from "./settings";
import {
  ACCEPTANCE_RESULTS,
  ACCEPTANCE_PRIORITIES,
} from "../shared/acceptance";
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
import { AcceptanceStore } from "./acceptance";
import { JsonStore, sourceIdentity } from "./storage";
import { Runner, flattenTests } from "./runners";
import { Scheduler } from "./scheduler";
import { NativeRunner } from "./native-runner";
import { NativeManager } from "./native";
import { PublicError } from "./public-error";
import { ReportExporter } from "./report";
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
const projectStore = settingsStore(
  data,
  join(root, "../Tunnelde-debugger-target"),
);
let settings = await projectStore.read();
let target = resolve(
  argument("--target") ?? process.env.TUNNELDE_TARGET ?? settings.targetPath,
);
settings = { ...settings, targetPath: target };
const port = Number(
  argument("--port") ?? process.env.PORT ?? settings.servicePort,
);
if (!Number.isInteger(port) || port < 1024 || port > 65532)
  throw new Error("Invalid debugger port (1024–65532)");
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
let scheduler = new Scheduler(target, data, changed, (kind) =>
  kind === "native"
    ? new NativeRunner(native, ensureNativeFrontend)
    : new Runner(kind, target),
);
await scheduler.initialize();
let native = new NativeManager(
  target,
  data,
  nativeFrontend,
  changed,
  settings.launch,
);
const recordsStore = new JsonStore<AcceptanceRecord[]>(
  join(data, "acceptance.json"),
  [],
);
const acceptance = new AcceptanceStore(recordsStore);
await acceptance.initialize();
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
const reports = new ReportExporter(data);
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
let reconfiguring = false;
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
        ws: { host: "127.0.0.1", port: port + 2 },
      },
    });
    await targetServer.listen();
  }
}

async function createRenderer() {
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
    console.error("Failed to create target renderer", error);
    targetError = "Target failed to start; see the server console for details.";
  }
}
await createRenderer();
const vite = await createViteServer({
  root,
  configFile: join(root, "vite.config.ts"),
  server: { middlewareMode: true, ws: { port: port + 3 } },
  appType: "spa",
});
async function body(
  request: IncomingMessage,
): Promise<Record<string, unknown>> {
  let bytes = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > (request.url === "/api/attachments" ? 12 : 1) * 1024 * 1024)
      throw new PublicError("Request body too large");
    chunks.push(chunk);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!value || Array.isArray(value) || typeof value !== "object")
    throw new PublicError("Expected object");
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
    throw new PublicError("Loopback only");
  if (
    request.headers.host !== `127.0.0.1:${port}` &&
    request.headers.host !== `localhost:${port}`
  )
    throw new PublicError("Unexpected Host");
  if (
    request.headers.origin &&
    request.headers.origin !== origin &&
    request.headers.origin !== `http://localhost:${port}`
  )
    throw new PublicError("Cross-origin access rejected");
  if (
    request.method !== "GET" &&
    !request.headers["content-type"]?.startsWith("application/json")
  )
    throw new PublicError("JSON content type required");
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
    if (reconfiguring && request.method !== "GET")
      throw new PublicError(
        "正在应用项目配置 / Project reconfiguration in progress",
      );
    const readOnly =
      [
        "/api/events",
        "/api/config",
        "/api/settings",
        "/api/scenarios",
        "/api/state",
        "/api/tests",
        "/api/report",
        "/api/acceptance/trash",
      ].includes(url.pathname) ||
      /^\/api\/reports\/[^/]+\.zip$/.test(url.pathname) ||
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
        source: await sourceIdentity(target).catch(() => ({
          path: target,
          revision: "unavailable",
          dirtyFingerprint: "",
          protocol: 1,
        })),
        rendererOrigin,
        workspace: root,
        targetError,
        protocol: 1,
        platform: process.platform,
      });
      return;
    }
    if (url.pathname === "/api/settings" && request.method === "GET") {
      json(response, {
        settings,
        active: { targetPath: target, servicePort: port },
        endpoints: {
          service: origin,
          renderer: rendererOrigin,
          nativeFrontend,
        },
        dataDirectory: data,
        project: await inspectProject(target).catch(() => null),
      });
      return;
    }
    if (url.pathname === "/api/settings/check") {
      const input = await body(request);
      const next = validateSettings(input);
      json(response, await inspectProject(next.targetPath));
      return;
    }
    if (url.pathname === "/api/settings/save") {
      const next = validateSettings(await body(request));
      reconfiguring = true;
      try {
        const project = await inspectProject(next.targetPath);
        if (
          scheduler.runs.some((run) =>
            ["running", "queued"].includes(run.status),
          ) ||
          discovering.size ||
          ["starting", "applying", "ready"].includes(native.state.state)
        )
          throw new PublicError(
            "请先停止实例和测试再修改配置 / Stop instances and tests before reconfiguration",
          );
        await projectStore.write(next);
        const pathChanged = target !== next.targetPath;
        settings = next;
        await native.stop();
        native = new NativeManager(
          next.targetPath,
          data,
          nativeFrontend,
          changed,
          next.launch,
        );
        if (pathChanged) {
          await frameServer?.close();
          frameServer = undefined;
          await targetServer?.close();
          targetServer = undefined;
          target = next.targetPath;
          targetError = undefined;
          browserReady.clear();
          testTree.clear();
          scheduler = new Scheduler(target, data, changed, (kind) =>
            kind === "native"
              ? new NativeRunner(native, ensureNativeFrontend)
              : new Runner(kind, target),
          );
          await scheduler.initialize();
          await createRenderer();
        }
        changed();
        json(response, {
          ok: true,
          restartRequired: next.servicePort !== port,
          project,
        });
      } finally {
        reconfiguring = false;
      }
      return;
    }
    if (url.pathname === "/api/scenarios") {
      json(response, scenarios);
      return;
    }
    if (url.pathname === "/api/state") {
      json(response, {
        runs: scheduler.runs.slice(-100),
        records: acceptance.list(),
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
        throw new PublicError("No full event journal for this run");
      const bytes = await readFile(join(data, "logs", run.eventLog));
      response.writeHead(200, {
        "Content-Type": "application/x-ndjson",
        "Content-Disposition": `attachment; filename="${run.id}.jsonl"`,
      });
      response.end(bytes);
      return;
    }
    if (url.pathname === "/api/tests" && request.method === "GET") {
      for (const run of scheduler.runs.filter(
        (run) => run.source.path === target,
      ))
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
        throw new PublicError("Unknown test runner");
      if (discovering.has(kind))
        throw new PublicError("Discovery already running");
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
        throw new PublicError("Expected test IDs");
      const available = flattenTests([...testTree.values()].flat());
      const selected = input.ids.map((id) => {
        const item = available.find((item) => item.id === id);
        if (!item) throw new PublicError(`Unknown test ID: ${id}`);
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
    if (url.pathname === "/api/acceptance/trash") {
      json(
        response,
        acceptance.list(true).filter((record) => record.deletedAt),
      );
      return;
    }
    const recordAction = /^\/api\/acceptance\/([^/]+)\/(delete|restore)$/.exec(
      url.pathname,
    );
    if (recordAction) {
      const input = await body(request);
      const record =
        recordAction[2] === "delete"
          ? await acceptance.remove(
              recordAction[1]!,
              String(input.expectedUpdatedAt),
            )
          : await acceptance.restore(recordAction[1]!);
      json(response, record);
      changed();
      return;
    }
    if (url.pathname === "/api/acceptance") {
      const input = await body(request);
      const existing = input.id
        ? acceptance.list().find((record) => record.id === input.id)
        : undefined;
      if (input.id && !existing)
        throw new PublicError("记录不存在 / Record not found");
      const context = existing ?? input;
      const scenario = scenarioById(String(context.scenarioId));
      const parameters = validateParameters(context.parameters);
      const targetKind = context.target as TargetKind;
      if (
        !scenario.targets.includes(targetKind) ||
        !Object.hasOwn(ACCEPTANCE_RESULTS, String(input.status)) ||
        !Object.hasOwn(
          ACCEPTANCE_PRIORITIES,
          String(input.priority ?? existing?.priority ?? "P2"),
        )
      )
        throw new PublicError("Invalid acceptance result");
      const browserEvidence = browserReady.get(String(input.ticket));
      const nativeMatches =
        native.state.state === "ready" &&
        native.state.scenarioId === scenario.id &&
        native.state.mode === targetKind &&
        JSON.stringify(native.state.parameters) ===
          JSON.stringify(parameters) &&
        input.generation === native.state.generation;
      // Failures and blocked scenes must remain reportable even if the target has exited.
      const source =
        existing?.source ??
        (targetKind === "browser"
          ? browserEvidence?.source
          : native.state.source) ??
        (await sourceIdentity(target));
      if (input.status === "passed" && existing?.status !== "passed") {
        if (
          targetKind === "browser" &&
          (!browserEvidence ||
            browserEvidence.scenarioId !== scenario.id ||
            JSON.stringify(browserEvidence.parameters) !==
              JSON.stringify(parameters))
        )
          throw new PublicError(
            "场景尚未就绪，仍可保存问题或阻塞记录 / Scene not ready for a pass",
          );
        if (targetKind !== "browser" && !nativeMatches)
          throw new PublicError(
            "原生场景尚未就绪，仍可保存问题或阻塞记录 / Native scene not ready for a pass",
          );
        const currentSource = await sourceIdentity(target);
        const liveSource =
          targetKind === "browser"
            ? browserEvidence!.source
            : native.state.source!;
        if (
          currentSource.revision !== source.revision ||
          currentSource.dirtyFingerprint !== source.dirtyFingerprint ||
          liveSource.dirtyFingerprint !== source.dirtyFingerprint
        )
          throw new PublicError(
            "源码已变化，请在当前场景新建验收记录 / Source changed; create a new acceptance record",
          );
      }
      const screenshots = Array.isArray(input.screenshots)
        ? input.screenshots
        : [];
      if (
        screenshots.length > 20 ||
        screenshots.some((name) => {
          if (typeof name !== "string" || basename(name) !== name) return true;
          if (existing?.screenshots.includes(name)) return false;
          const evidence = artifacts[name];
          return (
            !evidence ||
            evidence.scenarioId !== scenario.id ||
            evidence.target !== targetKind ||
            JSON.stringify(evidence.parameters) !==
              JSON.stringify(parameters) ||
            evidence.source.revision !== source.revision ||
            evidence.source.dirtyFingerprint !== source.dirtyFingerprint ||
            (targetKind !== "browser" &&
              input.status === "passed" &&
              !existing &&
              evidence.generation !== input.generation)
          );
        })
      )
        throw new PublicError(
          "图片不属于这条记录的场景与源码 / Attachment does not match this record",
        );
      await Promise.all(
        screenshots.map((name) => stat(join(data, "artifacts", String(name)))),
      );
      const record: AcceptanceRecord = {
        id: existing?.id ?? randomUUID(),
        scenarioId: scenario.id,
        target: targetKind,
        parameters,
        source,
        status: input.status as AcceptanceRecord["status"],
        priority: (input.priority ??
          existing?.priority ??
          "P2") as AcceptanceRecord["priority"],
        title: String(input.title ?? "").slice(0, 200),
        steps: String(input.steps ?? "").slice(0, 10000),
        expected: String(input.expected ?? "").slice(0, 10000),
        note: String(input.note ?? "").slice(0, 20000),
        screenshots: screenshots as string[],
        checklist: Array.isArray(input.checklist)
          ? input.checklist.filter(
              (value): value is string =>
                typeof value === "string" && scenario.checklist.includes(value),
            )
          : [],
        updatedAt: new Date().toISOString(),
        ...(targetKind !== "browser"
          ? { generation: existing?.generation ?? native.state.generation }
          : {}),
      };
      json(
        response,
        await acceptance.save(
          record,
          input.expectedUpdatedAt as string | undefined,
        ),
      );
      changed();
      return;
    }
    if (url.pathname === "/api/attachments") {
      const input = await body(request);
      const existing = input.recordId
        ? acceptance.list().find((record) => record.id === input.recordId)
        : undefined;
      if (input.recordId && !existing)
        throw new PublicError("记录不存在 / Record not found");
      const context = existing ?? input;
      const scenario = scenarioById(String(context.scenarioId));
      const parameters = validateParameters(context.parameters);
      if (!scenario.targets.includes(context.target as TargetKind))
        throw new PublicError("Invalid target");
      const image = String(input.image ?? "");
      if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image))
        throw new PublicError("仅接受 PNG 图片 / PNG image required");
      const bytes = Buffer.from(image.slice(image.indexOf(",") + 1), "base64");
      if (
        bytes.length < 24 ||
        bytes.length > 8 * 1024 * 1024 ||
        !bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
        bytes.toString("ascii", 12, 16) !== "IHDR" ||
        !bytes.readUInt32BE(16) ||
        !bytes.readUInt32BE(20) ||
        bytes.readUInt32BE(16) > 8192 ||
        bytes.readUInt32BE(20) > 8192
      )
        throw new PublicError(
          "图片无效或超过 8 MiB / Invalid image or over 8 MiB",
        );
      const name = `evidence-${randomUUID()}.png`;
      const browserEvidence = browserReady.get(String(input.ticket));
      const source =
        existing?.source ??
        (context.target === "browser"
          ? browserEvidence?.source
          : native.state.source) ??
        (await sourceIdentity(target));
      await mkdir(join(data, "artifacts"), { recursive: true });
      await writeFile(join(data, "artifacts", name), bytes, { mode: 0o600 });
      artifacts[name] = {
        scenarioId: scenario.id,
        target: context.target as TargetKind,
        parameters,
        source,
        generation: native.state.generation,
      };
      await artifactsStore.write(artifacts);
      json(response, { artifact: name });
      return;
    }
    if (url.pathname === "/api/report") {
      json(response, {
        version: 1,
        generatedAt: new Date().toISOString(),
        source: await sourceIdentity(target),
        coverage: scenarios,
        records: acceptance.list(),
        runs: scheduler.runs,
        native: native.state,
      });
      return;
    }
    if (url.pathname === "/api/report/export") {
      await body(request);
      // Records retain their original source identity even if the project moved.
      const source = await sourceIdentity(target).catch(() => ({
        path: target,
        revision: "unavailable",
        dirtyFingerprint: "",
        protocol: 1,
      }));
      json(
        response,
        await reports.create({
          version: 1,
          generatedAt: new Date().toISOString(),
          source,
          coverage: scenarios,
          records: acceptance.list(),
          runs: scheduler.runs,
          native: native.state,
        }),
      );
      return;
    }
    if (url.pathname === "/api/report/reveal") {
      const input = await body(request);
      await reports.reveal(String(input.filename));
      json(response, { ok: true });
      return;
    }
    if (/^\/api\/reports\/[^/]+\.zip$/.test(url.pathname)) {
      const filename = url.pathname.split("/").at(-1)!;
      const path = await reports.path(filename);
      response.writeHead(200, {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": (await stat(path)).size,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(await readFile(path));
      return;
    }
    if (url.pathname.startsWith("/api/native/") && scheduler.nativeBusy)
      throw new PublicError(
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
        throw new PublicError("Unsupported native scenario");
      await ensureNativeFrontend();
      json(response, await native.start(mode, scenario, parameters));
      return;
    }
    if (url.pathname === "/api/native/apply") {
      const input = await body(request);
      const scenario = scenarioById(String(input.scenarioId));
      if (native.state.mode === "native-service")
        throw new PublicError(
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
        throw new PublicError("Unregistered native action");
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
      const input = await body(request);
      const before = structuredClone(native.state);
      if (
        before.state !== "ready" ||
        input.scenarioId !== before.scenarioId ||
        input.generation !== before.generation ||
        JSON.stringify(input.parameters) !== JSON.stringify(before.parameters)
      )
        throw new PublicError(
          "Native screenshot does not match the selected scenario",
        );
      const artifact = await native.capture();
      if (
        before.runId !== native.state.runId ||
        before.generation !== native.state.generation
      )
        throw new PublicError("Native scene changed during capture");
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
      throw new PublicError(
        "请从当前场景截图或上传图片 / Capture the live scene or attach an image",
      );
    }
    if (url.pathname.startsWith("/artifacts/")) {
      const name = url.pathname.slice(11);
      if (basename(name) !== name || !name.endsWith(".png"))
        throw new PublicError("Invalid artifact");
      response.writeHead(200, {
        "Content-Type": "image/png",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(await readFile(join(data, "artifacts", name)));
      return;
    }
    json(response, { error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof PublicError) {
      json(response, { error: error.publicMessage }, error.status);
      return;
    }
    console.error("Request failed", error);
    json(response, { error: "Request failed" }, 500);
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
