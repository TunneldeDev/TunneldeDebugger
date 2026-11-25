import { ProjectSettingsDialog } from "./project-settings";
import { AnsiText } from "./ansi-text";
import { Select } from "./select";
import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Hand,
  Move,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  Code2,
  Download,
  ExternalLink,
  FileCode2,
  FlaskConical,
  Layers3,
  LoaderCircle,
  Monitor,
  Minus,
  Maximize2,
  PanelLeft,
  PanelRight,
  Moon,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Square,
  Sun,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import { localize } from "./i18n";
import { api } from "./api";
import { AcceptancePanel } from "./acceptance-panel";
import {
  DEFAULT_PARAMETERS,
  type ScenarioDefinition,
  type ScenarioParameters,
  type FrameMessage,
  type SourceIdentity,
  type TestRun,
  type TestItem,
  type RunnerKind,
  type AcceptanceRecord,
  type NativeState,
  type TargetKind,
} from "../shared/protocol";
interface Config {
  source: SourceIdentity;
  rendererOrigin: string;
  targetError?: string;
  platform: string;
}
interface State {
  runs: TestRun[];
  records: AcceptanceRecord[];
  native: NativeState;
  nativeLogs: string[];
}
const labels: Record<string, string> = {
  normal: "常规数据",
  empty: "空数据",
  loading: "加载中",
  error: "异常与失败",
  boundary: "边界数据",
  disabled: "禁用状态",
  queued: "排队中",
  running: "运行中",
  passed: "通过",
  failed: "失败",
  cancelled: "已取消",
  interrupted: "已中断",
  skipped: "已跳过",
  pending: "待检查",
  blocked: "阻塞",
  stopped: "未启动",
  starting: "构建与启动中",
  ready: "已就绪",
  applying: "应用场景中",
};
function Action({
  children,
  onClick,
  disabled,
  title,
  primary = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  primary?: boolean;
}) {
  return (
    <button
      className={`action ${primary ? "primary" : ""}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}
export function Workbench() {
  const [uiLocale, setUiLocale] = useState<"zh-CN" | "en-US">("zh-CN");
  const [section, setSection] = useState<"scenes" | "tests" | "native">(
    "scenes",
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectGeneration, setProjectGeneration] = useState(0);
  const [config, setConfig] = useState<Config>();
  const [scenes, setScenes] = useState<ScenarioDefinition[]>([]);
  const [selected, setSelected] = useState(
    new URLSearchParams(location.search).get("scene") ?? "hosts",
  );
  const [query, setQuery] = useState("");
  const [parameters, setParameters] =
    useState<ScenarioParameters>(DEFAULT_PARAMETERS);
  const [generation, setGeneration] = useState(1);
  const [ticket, setTicket] = useState<string>();
  const [ready, setReady] = useState(false);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [state, setState] = useState<State>({
    runs: [],
    records: [],
    native: { state: "stopped", generation: 0 },
    nativeLogs: [],
  });
  const [tree, setTree] = useState<Partial<Record<RunnerKind, TestItem[]>>>({});
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string>();
  const [selectedRun, setSelectedRun] = useState<string>();
  const [tool, setTool] = useState<"parameters" | "diagnostics" | "acceptance">(
    "parameters",
  );
  const [captureRequest, setCaptureRequest] = useState(0);
  const [mode, setMode] = useState<TargetKind>("native-mock");
  const [snapshot, setSnapshot] = useState<unknown>();
  const searchInput = useRef<HTMLInputElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [panMode, setPanMode] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panDrag = useRef<
    { x: number; y: number; originX: number; originY: number } | undefined
  >(undefined);
  const recenter = () => {
    setPan({ x: 0, y: 0 });
    setZoom("fit");
    if (canvas.current) {
      canvas.current.scrollTop = 0;
      canvas.current.scrollLeft = 0;
    }
  };

  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [catalogOpen, setCatalogOpen] = useState<boolean>();
  const [inspectorOpen, setInspectorOpen] = useState<boolean>();
  const inspectorVisible = inspectorOpen ?? false;
  const catalogOverlay = windowWidth < 850 || (inspectorVisible && windowWidth < 1180);
  const catalogVisible = catalogOpen ?? !catalogOverlay;
  // Keep the renderer's layout viewport intact; only scale its presentation.
  const frameWidth = parameters.width + 2;
  const frameHeight = parameters.height + 33;
  const fitScale =
    canvasSize.width && canvasSize.height
      ? Math.min(
          1,
          canvasSize.width / frameWidth,
          canvasSize.height / frameHeight,
        )
      : 1;
  const scale = zoom === "fit" ? fitScale : zoom;
  const changeZoom = (direction: number) =>
    setZoom(
      Math.min(
        2,
        Math.max(0.1, Math.round((scale + direction * 0.1) * 100) / 100),
      ),
    );
  useEffect(() => {
    const resize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setCanvasSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [section]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCatalogOpen(true);
        requestAnimationFrame(() => searchInput.current?.focus());
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const frame = useRef<HTMLIFrameElement>(null);
  const session = useRef(crypto.randomUUID());
  const scene = scenes.find((item) => item.id === selected);
  const refresh = useCallback(
    () =>
      Promise.all([
        api<State>("state"),
        api<Partial<Record<RunnerKind, TestItem[]>>>("tests"),
      ])
        .then(([state, tree]) => {
          setState(state);
          setTree(tree);
        })
        .catch((cause) => setError(String(cause))),
    [],
  );
  useEffect(() => {
    void Promise.all([
      api<Config>("config"),
      api<ScenarioDefinition[]>("scenarios"),
      api<Partial<Record<RunnerKind, TestItem[]>>>("tests"),
    ])
      .then(([c, s, t]) => {
        setConfig(c);
        setScenes(s);
        setTree(t);
      })
      .catch((cause) => setError(String(cause)));
    void refresh();
    const events = new EventSource("/api/events");
    events.addEventListener("changed", refresh);
    const timer = setInterval(refresh, 5000);
    const parametersEvent = (event: Event) =>
      setParameters((event as CustomEvent<ScenarioParameters>).detail);
    window.addEventListener("debugger:parameters", parametersEvent);
    return () => {
      events.close();
      clearInterval(timer);
      window.removeEventListener("debugger:parameters", parametersEvent);
    };
  }, [refresh]);
  useEffect(() => {
    setTicket(undefined);
    setReady(false);
    setGeneration((value) => value + 1);
    setDiagnostics([]);
    setSnapshot(undefined);
  }, [selected, parameters]);
  useEffect(() => {
    const receive = (event: MessageEvent<FrameMessage>) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== config?.rendererOrigin ||
        event.data.version !== 1 ||
        event.data.session !== session.current ||
        event.data.generation !== generation
      )
        return;
      const message = event.data;
      if (message.type === "ready" && message.scenarioId === selected) {
        void api<{ ticket: string }>("browser/ready", {
          scenarioId: selected,
          parameters,
        })
          .then((result) => {
            if (frame.current?.contentWindow !== event.source) return;
            setTicket(result.ticket);
            setReady(true);
          })
          .catch((cause) => setError(String(cause)));
      }
      if (message.type === "error") {
        setReady(false);
        setDiagnostics((previous) => [...previous.slice(-99), message.message]);
      }
      if (message.type === "diagnostic")
        setDiagnostics((previous) => [...previous.slice(-99), message.message]);
      if (message.type === "state") setSnapshot(message.snapshot);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [config, generation, selected, parameters]);
  useEffect(() => {
    if (scene && !scene.presets.includes(parameters.preset))
      setParameters((previous) => ({ ...previous, preset: "normal" }));
  }, [scene, parameters.preset]);
  const filtered = scenes.filter((item) =>
    `${item.category} ${item.title} ${item.titleEn} ${item.id}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const categories = [...new Set(filtered.map((item) => item.category))];
  const select = (id: string) => {
    setSelected(id);
    history.replaceState(null, "", `?scene=${id}`);
  };
  const move = (delta: number) => {
    const index = filtered.findIndex((item) => item.id === selected);
    const next = filtered[(index + delta + filtered.length) % filtered.length];
    if (next) select(next.id);
  };
  const perform = async (key: string, work: () => Promise<unknown>) => {
    setBusy(key);
    setError(undefined);
    try {
      await work();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(undefined);
    }
  };
  const discover = (runner: RunnerKind) =>
    perform(runner, async () => {
      const items = await api<TestItem[]>("tests/discover", { runner });
      setTree((previous) => ({ ...previous, [runner]: items }));
    });
  const runTests = (ids: string[]) =>
    perform("run", async () => {
      const run = await api<TestRun>("runs", { ids });
      setSelectedRun(run.id);
    });
  const run =
    state.runs.find((item) => item.id === selectedRun) ?? state.runs.at(-1);
  const acceptanceSource =
    section === "native"
      ? (state.native.source ?? config?.source)
      : config?.source;
  const nativeReady =
    state.native.state === "ready" &&
    state.native.scenarioId === selected &&
    state.native.mode === mode &&
    JSON.stringify(state.native.parameters) === JSON.stringify(parameters);
  const captureCurrent = async (): Promise<string> => {
    if (section === "native") {
      const result = await api<{ artifact: string }>("native/capture", {
        scenarioId: selected,
        parameters,
        generation: state.native.generation,
      });
      return result.artifact;
    }
    const element = frame.current;
    if (!element?.contentWindow || !config)
      throw new Error("场景尚未挂载 / Scene not mounted");
    const requestId = crypto.randomUUID();
    const image = await new Promise<string>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        clearInterval(watch);
        window.removeEventListener("message", receive);
      };
      const receive = (event: MessageEvent<FrameMessage>) => {
        const message = event.data;
        if (
          event.source !== element.contentWindow ||
          event.origin !== config.rendererOrigin ||
          message?.version !== 1 ||
          message.session !== session.current ||
          message.generation !== generation ||
          message.type !== "captured" ||
          message.requestId !== requestId
        )
          return;
        cleanup();
        if (message.error || !message.image)
          reject(new Error(message.error ?? "截图失败 / Capture failed"));
        else resolve(message.image);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            "截图超时，可上传或粘贴图片 / Capture timed out; attach an image instead",
          ),
        );
      }, 20000);
      const watch = setInterval(() => {
        if (frame.current !== element || !element.isConnected) {
          cleanup();
          reject(new Error("场景已切换 / Scene changed during capture"));
        }
      }, 100);
      window.addEventListener("message", receive);
      element.contentWindow!.postMessage(
        {
          version: 1,
          session: session.current,
          generation,
          type: "capture",
          requestId,
        },
        config.rendererOrigin,
      );
    });
    const result = await api<{ artifact: string }>("attachments", {
      scenarioId: selected,
      target: "browser",
      parameters,
      ticket,
      image,
    });
    return result.artifact;
  };
  const openAcceptance = (takeScreenshot = false) => {
    setTool("acceptance");
    setInspectorOpen(true);
    if (takeScreenshot) setCaptureRequest((previous) => previous + 1);
  };
  const exportReport = () =>
    perform("export", async () => {
      const report = await api("report");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(report, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `tunnelde-acceptance-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    });
  const patch = (value: Partial<ScenarioParameters>) =>
    setParameters((previous) => ({ ...previous, ...value }));
  return localize(
    <div
      className={`debugger ${tool === "acceptance" ? "accepting" : ""}`}
      lang={uiLocale}
    >
      <header className="topbar">
        <Select
          aria-label="Workbench language"
          value={uiLocale}
          onChange={(event) =>
            setUiLocale(event.target.value as "zh-CN" | "en-US")
          }
        >
          <option value="zh-CN">中文</option>
          <option value="en-US">English</option>
        </Select>
        <div className="brand">
          <img className="brand-icon" src="/app-icon.svg" alt="" />
          <strong>
            Tunnelde<span>Debugger</span>
          </strong>
          <span className="version">0.1</span>
        </div>
        <div className="workspace-path">
          本地工作区<span className="divider">/</span>
          <span title={config?.source.path}>
            {config?.source.path.split("/").at(-1) ?? "连接中…"}
          </span>
          <code>{config?.source.revision.slice(0, 7)}</code>
        </div>
        <button
          className="text-button"
          onClick={() => setSettingsOpen(true)}
          aria-label="项目配置"
          title="项目配置"
        >
          <Settings2 size={14} />
          <span>项目配置</span>
        </button>
        <button
          className="text-button"
          onClick={exportReport}
          aria-label="导出报告"
          title="导出报告"
        >
          <Download size={14} />
          <span>导出报告</span>
        </button>
      </header>
      <div className="layout">
        <nav className="rail" aria-label="工作台导航">
          <button
            className={section === "scenes" ? "active" : ""}
            onClick={() => setSection("scenes")}
            title="场景"
          >
            <Layers3 size={21} />
            <span>场景</span>
          </button>
          <button
            className={section === "tests" ? "active" : ""}
            onClick={() => setSection("tests")}
            title="测试"
          >
            <FlaskConical size={21} />
            <span>测试</span>
            {state.runs.some((item) => item.status === "running") && <i />}
          </button>
          <button
            className={section === "native" ? "active" : ""}
            onClick={() => setSection("native")}
            title="桌面实例"
          >
            <Monitor size={21} />
            <span>原生</span>
          </button>
        </nav>
        {catalogOverlay && catalogVisible && (
          <button
            className="panel-scrim"
            aria-label="收起侧栏"
            onClick={() => {
              setCatalogOpen(false);
              setInspectorOpen(false);
            }}
          />
        )}
        <aside id="catalog" className="catalog" hidden={!catalogVisible}>
          <div className="catalog-heading">
            <span>
              {section === "tests" ? "测试资源管理器" : "场景资源管理器"}
            </span>
            <span className="count">
              {section === "tests"
                ? Object.values(tree).flat().length
                : scenes.length}
            </span>
          </div>
          <div className="search">
            <Search size={14} />
            <input
              ref={searchInput}
              aria-label="搜索场景或测试"
              placeholder={
                section === "tests" ? "搜索测试…" : "搜索界面、面板、场景…"
              }
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <kbd>⌘ K</kbd>
          </div>
          <div className="catalog-scroll">
            {section === "tests" ? (
              <>
                {(
                  [
                    "vitest",
                    "rust",
                    "node",
                    "playwright",
                    "native",
                  ] as RunnerKind[]
                ).map((kind) => (
                  <div className="test-group" key={kind}>
                    <div className="group-heading">
                      <span>{kind.toUpperCase()}</span>
                      <button
                        onClick={() => void discover(kind)}
                        disabled={!!busy}
                        title={`发现 ${kind} 测试`}
                      >
                        {busy === kind ? (
                          <LoaderCircle className="spin" size={13} />
                        ) : (
                          <RefreshCw size={13} />
                        )}
                      </button>
                    </div>
                    {tree[kind]?.length ? (
                      groupDirectories(kind, tree[kind]!)
                        .filter(
                          (item) =>
                            !query ||
                            JSON.stringify(item)
                              .toLowerCase()
                              .includes(query.toLowerCase()),
                        )
                        .map((item) => (
                          <TestNode
                            key={item.id}
                            item={item}
                            checked={checked}
                            change={(id, value) =>
                              setChecked((previous) => {
                                const next = new Set(previous);
                                value ? next.add(id) : next.delete(id);
                                return next;
                              })
                            }
                          />
                        ))
                    ) : (
                      <button
                        className="discover"
                        onClick={() => void discover(kind)}
                      >
                        发现测试 <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </>
            ) : (
              categories.map((category) => (
                <div className="category" key={category}>
                  <div className="group-heading">
                    <span>{category}</span>
                  </div>
                  {filtered
                    .filter((item) => item.category === category)
                    .map((item) => (
                      <button
                        key={item.id}
                        className={`scene-item ${selected === item.id ? "selected" : ""}`}
                        onClick={() => select(item.id)}
                      >
                        <FileCode2 size={14} />
                        <span>{item.title}</span>
                      </button>
                    ))}
                </div>
              ))
            )}
          </div>
        </aside>
        <main className="main">
          <div className="main-heading">
            <button
              className="panel-toggle"
              title="切换资源管理器"
              aria-label="切换资源管理器"
              aria-controls="catalog"
              aria-expanded={catalogVisible}
              onClick={() => setCatalogOpen(!catalogVisible)}
            >
              <PanelLeft size={16} />
            </button>
            <div className="breadcrumbs">
              <span>{section === "tests" ? "测试运行" : scene?.category}</span>
              <ChevronRight size={12} />
              <strong>
                {section === "tests" ? "运行控制台" : scene?.title}
              </strong>
            </div>
            <div className="heading-actions">
              {section === "tests" ? (
                <>
                  <Action
                    onClick={() => void runTests([...checked])}
                    disabled={!checked.size || !!busy}
                    primary
                  >
                    <Play size={13} />
                    运行选中 ({checked.size})
                  </Action>
                  <Action
                    onClick={() =>
                      void runTests(
                        Object.values(tree)
                          .flat()
                          .map((item) => item.id),
                      )
                    }
                    disabled={!Object.values(tree).flat().length || !!busy}
                  >
                    运行已发现全部
                  </Action>
                </>
              ) : (
                <>
                  <span
                    className={`status-pill ${section === "native" ? state.native.state : ready ? "ready" : "loading"}`}
                  >
                    {section === "native" ? (
                      <Monitor size={11} />
                    ) : ready ? (
                      <CircleCheck size={11} />
                    ) : (
                      <LoaderCircle size={11} className="spin" />
                    )}
                    {section === "native"
                      ? labels[state.native.state]
                      : ready
                        ? "场景就绪"
                        : "加载场景"}
                  </span>
                  <Action
                    onClick={() => openAcceptance(true)}
                    disabled={
                      !!busy ||
                      (section === "native"
                        ? !nativeReady
                        : !!config?.targetError || !scene)
                    }
                  >
                    <Camera size={13} />
                    截图
                  </Action>
                  <Action onClick={() => openAcceptance()} primary>
                    记录问题
                  </Action>
                </>
              )}
              <button
                className="panel-toggle"
                title="切换检查器"
                aria-label="切换检查器"
                aria-controls="inspector"
                aria-expanded={inspectorVisible}
                onClick={() => setInspectorOpen(!inspectorVisible)}
              >
                <PanelRight size={16} />
              </button>
            </div>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <X size={14} />
              <span>{error}</span>
              <button onClick={() => setError(undefined)}>关闭</button>
            </div>
          )}
          {config?.targetError && (
            <div className="error-banner" role="alert">
              目标适配器不可用：{config.targetError}
            </div>
          )}
          {section === "tests" ? (
            <div className="tests-content">
              <section className="run-list">
                <div className="section-caption">
                  运行记录 <span>{state.runs.length}</span>
                </div>
                {[...state.runs].reverse().map((item) => (
                  <button
                    key={item.id}
                    className={`run-card ${run?.id === item.id ? "selected" : ""}`}
                    onClick={() => setSelectedRun(item.id)}
                  >
                    <span className={`run-status ${item.status}`}>
                      {labels[item.status]}
                    </span>
                    <strong>{item.items.length} 项测试</strong>
                    <time>{new Date(item.createdAt).toLocaleTimeString()}</time>
                  </button>
                ))}
                {!state.runs.length && (
                  <Empty
                    icon={<FlaskConical size={30} />}
                    title="从一次测试开始"
                    body="在左侧发现测试，选择文件或用例后运行。"
                  />
                )}
              </section>
              <section className="console">
                <div className="console-heading">
                  <Terminal size={14} />
                  <span>测试输出</span>
                  <code>{run?.id.slice(0, 8)}</code>
                  {run && ["running", "queued"].includes(run.status) && (
                    <Action
                      onClick={() =>
                        void perform("cancel", () =>
                          api(`runs/${run.id}/cancel`, {}),
                        )
                      }
                    >
                      <Square size={12} />
                      取消
                    </Action>
                  )}
                  {run?.status === "failed" && (
                    <Action
                      onClick={() =>
                        void runTests([
                          ...new Set(
                            Object.values(
                              run.results ??
                                Object.fromEntries(
                                  run.events.map((event) => [
                                    event.sequence,
                                    event,
                                  ]),
                                ),
                            )
                              .filter(
                                (event) =>
                                  event.type === "case" &&
                                  event.status === "failed",
                              )
                              .map((event) => event.itemId)
                              .filter(
                                (id): id is string =>
                                  !!id &&
                                  Object.values(tree)
                                    .flat()
                                    .flatMap(flatten)
                                    .some((item) => item.id === id),
                              ),
                          ),
                        ])
                      }
                    >
                      重跑失败
                    </Action>
                  )}
                </div>
                {run?.eventLog && (
                  <a
                    className="text-button"
                    href={`/api/runs/${run.id}/events`}
                  >
                    下载完整事件日志
                  </a>
                )}
                <div className="console-body">
                  {run?.events.map((event) => (
                    <div
                      className={`log-line ${event.status ?? ""}`}
                      key={event.sequence}
                    >
                      <span>{event.time.slice(11, 23)}</span>
                      <code>
                        {event.type === "case" ? (
                          `[${labels[event.status ?? ""] ?? event.status}] ${event.text ?? event.itemId}${event.duration !== undefined ? ` (${Math.round(event.duration)}ms)` : ""}`
                        ) : (
                          <AnsiText text={event.text ?? ""} />
                        )}
                        {event.artifact && (
                          <a
                            href={`/artifacts/${event.artifact}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {" "}
                            {event.artifact}
                          </a>
                        )}
                      </code>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : section === "native" ? (
            <div className="native-content">
              <div className="native-hero">
                <div className="native-symbol">
                  <Monitor size={34} />
                </div>
                <h1>在真实桌面中验收</h1>
                <p>
                  把当前场景发送到隔离的 Tunnelde 实例。
                  <br />
                  窗口、服务状态与验收记录保持关联。
                </p>
                <div className="native-mode">
                  <button
                    className={mode === "native-mock" ? "selected" : ""}
                    onClick={() => setMode("native-mock")}
                  >
                    <Layers3 size={16} />
                    <strong>界面模拟</strong>
                    <small>可控数据 · 状态与边界</small>
                  </button>
                  <button
                    className={mode === "native-service" ? "selected" : ""}
                    onClick={() => setMode("native-service")}
                  >
                    <Zap size={16} />
                    <strong>真实服务</strong>
                    <small>隔离数据 · 实际读写</small>
                  </button>
                </div>
                <div className="native-actions">
                  <Action onClick={() => move(-1)}>上一个</Action>
                  <Action onClick={() => move(1)}>下一个场景</Action>
                  {mode === "native-mock" &&
                    state.native.mode === mode &&
                    state.native.state === "ready" && (
                      <Action
                        disabled={!!busy}
                        onClick={() =>
                          void perform("apply", () =>
                            api("native/apply", {
                              scenarioId: selected,
                              parameters,
                            }),
                          )
                        }
                      >
                        应用到当前模拟实例
                      </Action>
                    )}
                  <Action
                    primary
                    disabled={
                      !!busy ||
                      !scene?.targets.includes(mode) ||
                      ["starting", "applying"].includes(state.native.state)
                    }
                    onClick={() =>
                      void perform("native", () =>
                        api("native/start", {
                          mode,
                          scenarioId: selected,
                          parameters,
                        }),
                      )
                    }
                  >
                    <Play size={14} />
                    {state.native.state === "stopped"
                      ? "启动并注入场景"
                      : "重启并注入场景"}
                  </Action>
                  <Action
                    disabled={state.native.state === "stopped" || !!busy}
                    onClick={() =>
                      void perform("native-stop", () => api("native/stop", {}))
                    }
                  >
                    <Square size={13} />
                    停止
                  </Action>
                  {nativeReady && mode === "native-service" && (
                    <Action
                      onClick={() =>
                        void perform("present", () =>
                          api("native/action", {
                            method: "debug.present",
                            params: {
                              generation: state.native.generation,
                              placement: "native",
                            },
                          }),
                        )
                      }
                    >
                      <ExternalLink size={13} />
                      移动到原生小窗
                    </Action>
                  )}
                  {nativeReady && mode === "native-service" && (
                    <>
                      <Action
                        onClick={() =>
                          void perform("return", () =>
                            api("native/action", {
                              method: "debug.present",
                              params: {
                                generation: state.native.generation,
                                placement: "main",
                              },
                            }),
                          )
                        }
                      >
                        返回主窗口
                      </Action>
                      <Action
                        onClick={() =>
                          void perform("verify", () =>
                            api("native/action", {
                              method: "debug.check",
                              params: { generation: state.native.generation },
                            }),
                          )
                        }
                      >
                        检查真实读写
                      </Action>
                    </>
                  )}
                </div>
                {scene?.limitation && mode === "native-service" && (
                  <div className="limitation">{scene.limitation}</div>
                )}
                <div className="instance-info">
                  <span>
                    实例 <code>{state.native.runId?.slice(0, 8) ?? "—"}</code>
                  </span>
                  <span>
                    代次 <code>{state.native.generation}</code>
                  </span>
                  <span>
                    平台 <code>{config?.platform} · macOS 首验</code>
                  </span>
                </div>
                {state.native.error && (
                  <div className="error-banner">{state.native.error}</div>
                )}
              </div>
              <section className="native-console console">
                <div className="console-heading">
                  <Terminal size={13} />
                  构建与实例日志
                </div>
                <div className="console-body">
                  {state.nativeLogs.map((line, i) => (
                    <div className="log-line" key={i}>
                      <code>
                        <AnsiText text={line} />
                      </code>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <>
              <div className="preview-toolbar">
                <Select
                  aria-label="数据预设"
                  value={parameters.preset}
                  onChange={(event) =>
                    patch({
                      preset: event.target
                        .value as ScenarioParameters["preset"],
                    })
                  }
                >
                  {scene?.presets.map((preset) => (
                    <option key={preset} value={preset}>
                      {labels[preset]}
                    </option>
                  ))}
                </Select>
                <span className="toolbar-divider" />
                <button
                  title="切换明暗主题"
                  onClick={() =>
                    patch({
                      theme: parameters.theme === "dark" ? "light" : "dark",
                    })
                  }
                >
                  {parameters.theme === "dark" ? (
                    <Moon size={14} />
                  ) : (
                    <Sun size={14} />
                  )}
                </button>
                <Select
                  aria-label="场景语言"
                  value={parameters.locale}
                  onChange={(event) =>
                    patch({
                      locale: event.target
                        .value as ScenarioParameters["locale"],
                    })
                  }
                >
                  <option value="zh-CN">简体中文</option>
                  <option value="en-US">English</option>
                </Select>
                <span className="toolbar-spacer" />
                <button
                  title="拖动画布"
                  aria-label="拖动画布"
                  aria-pressed={panMode}
                  className={panMode ? "selected" : ""}
                  onClick={() => setPanMode(!panMode)}
                >
                  <Hand size={14} />
                </button>
                <button
                  title="居中画布"
                  aria-label="居中画布"
                  onClick={recenter}
                >
                  <Move size={14} />
                </button>
                <div
                  className="zoom-controls"
                  role="group"
                  aria-label="预览缩放"
                >
                  <button
                    title="缩小预览"
                    aria-label="缩小预览"
                    disabled={scale <= 0.1}
                    onClick={() => changeZoom(-1)}
                  >
                    <Minus size={14} />
                  </button>
                  <Select
                    aria-label="预览比例"
                    value={zoom === "fit" ? "fit" : String(zoom)}
                    onChange={(event) =>
                      setZoom(
                        event.target.value === "fit"
                          ? "fit"
                          : Number(event.target.value),
                      )
                    }
                  >
                    <option value="fit">
                      适应窗口 · {Math.round(fitScale * 100)}%
                    </option>
                    {[
                      ...new Set([
                        0.1,
                        0.25,
                        0.5,
                        0.75,
                        1,
                        1.25,
                        1.5,
                        2,
                        ...(zoom === "fit" ? [] : [zoom]),
                      ]),
                    ]
                      .sort((a, b) => a - b)
                      .map((value) => (
                        <option key={value} value={String(value)}>
                          {Math.round(value * 100)}%
                        </option>
                      ))}
                  </Select>
                  <button
                    title="放大预览"
                    aria-label="放大预览"
                    disabled={scale >= 2}
                    onClick={() => changeZoom(1)}
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    className={zoom === "fit" ? "selected" : ""}
                    title="适应窗口"
                    aria-label="适应窗口"
                    aria-pressed={zoom === "fit"}
                    onClick={recenter}
                  >
                    <Maximize2 size={14} />
                  </button>
                </div>
                <code className="viewport-size" title="渲染视口尺寸">
                  {parameters.width} × {parameters.height}
                </code>
                <button
                  title="重新加载场景"
                  onClick={() => {
                    setTicket(undefined);
                    setReady(false);
                    setGeneration((value) => value + 1);
                  }}
                >
                  <RefreshCw size={14} />
                </button>
              </div>
              <div
                className={`preview-canvas ${panMode ? "pan-mode" : ""}`}
                ref={canvas}
                onPointerDown={(event) => {
                  if (
                    event.button !== 0 ||
                    (!(event.target as Element).closest(".frame-chrome") &&
                      !(event.target as Element).closest(
                        ".canvas-drag-surface",
                      ))
                  )
                    return;
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  panDrag.current = {
                    x: event.clientX,
                    y: event.clientY,
                    originX: pan.x,
                    originY: pan.y,
                  };
                }}
                onPointerMove={(event) => {
                  const drag = panDrag.current;
                  if (drag)
                    setPan({
                      x: drag.originX + event.clientX - drag.x,
                      y: drag.originY + event.clientY - drag.y,
                    });
                }}
                onPointerUp={() => {
                  panDrag.current = undefined;
                }}
                onPointerCancel={() => {
                  panDrag.current = undefined;
                }}
              >
                {panMode && (
                  <div
                    className="canvas-drag-surface"
                    aria-label="拖动画布区域"
                  />
                )}
                <div
                  className="frame-stage"
                  style={{
                    width: frameWidth * scale,
                    height: frameHeight * scale,
                    transform: `translate(${pan.x}px, ${pan.y}px)`,
                  }}
                >
                  <div
                    className="frame-container"
                    style={{
                      width: parameters.width,
                      height: parameters.height,
                      transform: `scale(${scale})`,
                    }}
                  >
                    <div className="frame-chrome">
                      <code>tunnelde / {selected}</code>
                    </div>
                    {config && scene && !config.targetError && (
                      <iframe
                        key={`${projectGeneration}:${selected}:${generation}`}
                        ref={frame}
                        title={`Tunnelde 场景：${scene.title}`}
                        src={`${config.rendererOrigin}/renderer.html?session=${session.current}&generation=${generation}&parentOrigin=${encodeURIComponent(location.origin)}`}
                        style={{
                          width: parameters.width,
                          height: parameters.height,
                        }}
                        onLoad={() =>
                          frame.current?.contentWindow?.postMessage(
                            {
                              type: "apply",
                              version: 1,
                              session: session.current,
                              generation,
                              scenario: scene,
                              parameters,
                            },
                            config.rendererOrigin,
                          )
                        }
                      />
                    )}
                    {!ready && (
                      <div className="frame-loading">
                        <LoaderCircle className="spin" size={20} />
                        <span>正在挂载生产界面…</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="scene-pagination">
                <span>
                  <code>
                    {String(
                      filtered.findIndex((item) => item.id === selected) + 1,
                    ).padStart(2, "0")}
                  </code>{" "}
                  / {filtered.length} 个场景{" "}
                  <span className="subtle">· {selected}</span>
                </span>
                <div>
                  <Action onClick={() => move(-1)}>
                    <ArrowLeft size={13} />
                    上一个
                  </Action>
                  <Action onClick={() => move(1)}>
                    下一个场景
                    <ArrowRight size={13} />
                  </Action>
                </div>
              </div>
            </>
          )}
        </main>
        <aside
          id="inspector"
          className="inspector"
          hidden={!inspectorVisible}
        >
          <div className="inspector-heading">
            <span>检查器</span>
            <button
              className="panel-toggle"
              aria-label="关闭检查器"
              title="关闭检查器"
              onClick={() => setInspectorOpen(false)}
            >
              <X size={15} />
            </button>
          </div>
          <div className="inspector-tabs">
            <button
              className={tool === "parameters" ? "selected" : ""}
              onClick={() => setTool("parameters")}
            >
              <Settings2 size={13} />
              参数
            </button>
            <button
              className={tool === "diagnostics" ? "selected" : ""}
              onClick={() => setTool("diagnostics")}
            >
              <Code2 size={13} />
              诊断
              {diagnostics.length > 1 && <span>{diagnostics.length - 1}</span>}
            </button>
            <button
              className={tool === "acceptance" ? "selected" : ""}
              onClick={() => setTool("acceptance")}
            >
              <ClipboardCheck size={13} />
              验收
            </button>
          </div>
          <div className="inspector-body">
            {tool === "parameters" ? (
              <>
                <h2>{scene?.title}</h2>
                <label className="control-label">数据预设</label>
                <div className="preset-grid">
                  {scene?.presets.map((preset) => (
                    <button
                      key={preset}
                      className={parameters.preset === preset ? "selected" : ""}
                      onClick={() => patch({ preset })}
                    >
                      <span className={`preset-dot ${preset}`} />
                      {labels[preset]}
                    </button>
                  ))}
                </div>
                <div className="muted">
                  {Object.values(scene?.unsupportedPresets ?? {}).map(
                    (reason) => (
                      <details key={reason}>
                        <summary>{reason?.split(":")[0]} · N/A</summary>
                        {reason}
                      </details>
                    ),
                  )}
                </div>
                <label className="control-label">
                  数据条目 <span>0 – 10,000</span>
                </label>
                <input
                  className="number-input"
                  type="number"
                  aria-label="数据条目"
                  min={0}
                  max={10000}
                  value={parameters.count}
                  onChange={(event) => {
                    const count = Number(event.target.value);
                    if (
                      Number.isSafeInteger(count) &&
                      count >= 0 &&
                      count <= 10000
                    )
                      patch({ count });
                  }}
                />
                <div className="field-row">
                  <label>
                    宽度
                    <input
                      aria-label="视口宽度"
                      type="number"
                      min={280}
                      max={3840}
                      value={parameters.width}
                      onChange={(event) => {
                        const width = Number(event.target.value);
                        if (width >= 280 && width <= 3840) patch({ width });
                      }}
                    />
                  </label>
                  <span>×</span>
                  <label>
                    高度
                    <input
                      aria-label="视口高度"
                      type="number"
                      min={200}
                      max={2160}
                      value={parameters.height}
                      onChange={(event) => {
                        const height = Number(event.target.value);
                        if (height >= 200 && height <= 2160) patch({ height });
                      }}
                    />
                  </label>
                </div>
                <div className="viewport-presets">
                  {[
                    ["窄面板", 420, 760],
                    ["桌面", 1280, 800],
                    ["宽屏", 1920, 1080],
                  ].map(([title, width, height]) => (
                    <button
                      key={title}
                      onClick={() =>
                        patch({ width: Number(width), height: Number(height) })
                      }
                    >
                      {title}
                    </button>
                  ))}
                </div>
                <label className="control-label">固定随机种子</label>
                <input
                  aria-label="随机种子"
                  className="number-input"
                  type="number"
                  min={0}
                  max={2147483647}
                  value={parameters.seed}
                  onChange={(event) => {
                    const seed = Number(event.target.value);
                    if (
                      Number.isSafeInteger(seed) &&
                      seed >= 0 &&
                      seed <= 2147483647
                    )
                      patch({ seed });
                  }}
                />
                <div className="inspector-rule" />
                <Action
                  onClick={() => {
                    setParameters(DEFAULT_PARAMETERS);
                    setGeneration((value) => value + 1);
                  }}
                >
                  <RefreshCw size={13} />
                  重置配置
                </Action>
              </>
            ) : tool === "diagnostics" ? (
              <>
                <div className="section-caption">
                  渲染诊断 <span>{diagnostics.length}</span>
                </div>
                {diagnostics.map((line, index) => (
                  <pre className="diagnostic-entry" key={index}>
                    {line}
                  </pre>
                ))}
                <Action
                  onClick={() => {
                    if (section === "native")
                      void perform("snapshot", async () =>
                        setSnapshot(
                          await api("native/action", {
                            method: "debug.snapshot",
                            params: { generation: state.native.generation },
                          }),
                        ),
                      );
                    else
                      frame.current?.contentWindow?.postMessage(
                        {
                          version: 1,
                          session: session.current,
                          generation,
                          type: "snapshot",
                        },
                        config!.rendererOrigin,
                      );
                  }}
                  disabled={section === "native" ? !nativeReady : !ready}
                >
                  <Code2 size={13} />
                  读取场景状态
                </Action>
                {snapshot !== undefined && (
                  <pre className="snapshot">
                    {JSON.stringify(snapshot, null, 2)}
                  </pre>
                )}
                <p className="muted">
                  源码 {config?.source.revision.slice(0, 12)}
                  <br />
                  工作区 {config?.source.dirtyFingerprint.slice(0, 12)}
                </p>
              </>
            ) : null}
            {config && scene && (
              <div hidden={tool !== "acceptance"}>
                <AcceptancePanel
                  key={`${selected}:${section === "native" ? mode : "browser"}:${JSON.stringify(parameters)}:${acceptanceSource?.path}:${acceptanceSource?.revision}:${acceptanceSource?.dirtyFingerprint}`}
                  scene={scene}
                  parameters={parameters}
                  target={section === "native" ? mode : "browser"}
                  source={acceptanceSource!}
                  ticket={ticket}
                  generation={state.native.generation}
                  records={state.records}
                  captureRequest={captureRequest}
                  capture={captureCurrent}
                  canCapture={
                    section === "native"
                      ? nativeReady
                      : !config.targetError
                  }
                  canPass={section === "native" ? nativeReady : ready}
                  locale={uiLocale}
                  refresh={refresh}
                />
              </div>
            )}
          </div>
        </aside>
      </div>
      {settingsOpen && (
        <ProjectSettingsDialog
          locale={uiLocale}
          onClose={() => setSettingsOpen(false)}
          onApply={async () => {
            const next = await api<Config>("config");
            setConfig(next);
            setReady(false);
            setTicket(undefined);
            setGeneration((value) => value + 1);
            setProjectGeneration((value) => value + 1);
            setChecked(new Set());
            setSnapshot(undefined);
            setDiagnostics([]);
            await refresh();
          }}
        />
      )}
      <footer className="statusbar">
        <span>{scenes.length} 个内置场景</span>
        <span>
          {state.runs.filter((item) => item.status === "running").length} 运行中
        </span>
        <span className="status-spacer" />
        {ready && <span data-testid="scene-ready">场景已就绪</span>}
      </footer>
    </div>,
    uiLocale,
  );
}
function groupDirectories(kind: RunnerKind, files: TestItem[]): TestItem[] {
  const roots: TestItem[] = [];
  for (const item of files) {
    if (!item.file) {
      roots.push(item);
      continue;
    }
    const parts = item.file.split("/");
    let level = roots;
    let prefix = "";
    for (const part of parts.slice(0, -1)) {
      prefix += `${part}/`;
      const id = `directory:${kind}:${prefix}`;
      let folder = level.find((node) => node.id === id);
      if (!folder) {
        folder = { id, runner: kind, label: part, children: [] };
        level.push(folder);
      }
      level = folder.children!;
    }
    level.push({ ...item, label: parts.at(-1)! });
  }
  return roots;
}
function flatten(item: TestItem): TestItem[] {
  return [item, ...(item.children ?? []).flatMap(flatten)];
}
function TestNode({
  item,
  checked,
  change,
}: {
  item: TestItem;
  checked: Set<string>;
  change: (id: string, checked: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="test-node">
      <div className="test-node-row">
        {item.children ? (
          <button
            onClick={() => setOpen((value) => !value)}
            aria-label={`展开 ${item.label}`}
            aria-expanded={open}
          >
            {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        ) : (
          <FileCode2 size={11} aria-hidden="true" />
        )}
        <input
          type="checkbox"
          aria-label={`选择 ${item.label}`}
          disabled={!!item.unavailable || item.ignored}
          checked={
            item.id.startsWith("directory:")
              ? flatten(item)
                  .filter((node) => !node.children)
                  .every((node) => checked.has(node.id))
              : checked.has(item.id)
          }
          onChange={(event) => {
            if (item.id.startsWith("directory:"))
              flatten(item)
                .filter(
                  (node) =>
                    !node.id.startsWith("directory:") &&
                    !node.children &&
                    !node.ignored &&
                    !node.unavailable,
                )
                .forEach((node) => change(node.id, event.target.checked));
            else change(item.id, event.target.checked);
          }}
        />
        <span title={item.unavailable ?? item.label}>
          {item.label}
          {item.ignored
            ? " (ignored)"
            : item.unavailable
              ? " (unavailable)"
              : ""}
        </span>
        {item.children && <small>{item.children.length}</small>}
      </div>
      {open &&
        item.children?.map((child) => (
          <TestNode
            key={child.id}
            item={child}
            checked={checked}
            change={change}
          />
        ))}
    </div>
  );
}
function Empty({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="empty-state">
      {icon}
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}
