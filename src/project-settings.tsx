import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { localize } from "./i18n";
import type { ProjectSettings } from "../shared/project";
interface SettingsResponse {
  settings: ProjectSettings;
  active: { targetPath: string; servicePort: number };
  endpoints: { service: string; renderer: string; nativeFrontend: string };
  dataDirectory: string;
  project: { name: string; adapter: boolean } | null;
}
export function ProjectSettingsDialog({
  locale,
  onClose,
  onApply,
}: {
  locale: "zh-CN" | "en-US";
  onClose: () => void;
  onApply: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [info, setInfo] = useState<SettingsResponse>();
  const [path, setPath] = useState("");
  const [port, setPort] = useState(4760);
  const [cargo, setCargo] = useState("[]");
  const [args, setArgs] = useState("[]");
  const [env, setEnv] = useState("{}");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = async () => {
    const value = await api<SettingsResponse>("settings");
    setInfo(value);
    setPath(value.settings.targetPath);
    setPort(value.settings.servicePort);
    setCargo(JSON.stringify(value.settings.launch.cargoArgs));
    setArgs(JSON.stringify(value.settings.launch.appArgs));
    setEnv(JSON.stringify(value.settings.launch.env, null, 2));
  };
  useEffect(() => {
    dialog.current?.showModal();
    void load().catch((cause) => setError(String(cause)));
  }, []);
  const submit = async (save: boolean) => {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const settings: ProjectSettings = {
        targetPath: path,
        servicePort: port,
        launch: {
          cargoArgs: JSON.parse(cargo),
          appArgs: JSON.parse(args),
          env: JSON.parse(env),
        },
      };
      if (save) {
        const result = await api<{
          restartRequired: boolean;
          project: { adapter: boolean };
        }>("settings/save", settings);
        await load();
        await onApply();
        setMessage(
          result.restartRequired
            ? "配置已保存，服务端口将在重启 Debugger 后生效"
            : "配置已保存并应用",
        );
        if (!result.project.adapter)
          setError(
            "项目缺少场景适配器；请先在隔离副本应用 integration/tunnelde.patch / Scene adapter missing; apply integration/tunnelde.patch in an isolated checkout",
          );
      } else {
        const result = await api<{ adapter: boolean }>(
          "settings/check",
          settings,
        );
        setMessage(
          result.adapter
            ? "项目与场景适配器可用"
            : "项目有效，但缺少场景适配器",
        );
      }
    } catch (cause) {
      setError(
        cause instanceof SyntaxError
          ? "参数与环境变量需要有效的 JSON / Arguments and environment require valid JSON"
          : String(cause instanceof Error ? cause.message : cause),
      );
    } finally {
      setBusy(false);
    }
  };
  return localize(
    <dialog
      ref={dialog}
      className="project-dialog"
      aria-label="项目配置"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header>
        <strong>项目配置</strong>
        <button
          className="action"
          aria-label="关闭项目配置"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="project-fields">
        <label>
          本地 Tunnelde 项目路径
          <input
            aria-label="本地 Tunnelde 项目路径"
            value={path}
            disabled={busy}
            onChange={(event) => setPath(event.target.value)}
            placeholder="/path/to/Tunnelde"
          />
        </label>
        <p>使用含开发场景适配器的本地项目。切换项目前请停止实例和测试。</p>
        <label>
          服务端口
          <input
            aria-label="服务端口"
            type="number"
            min={1024}
            max={65532}
            value={port}
            disabled={busy}
            onChange={(event) => setPort(Number(event.target.value))}
          />
        </label>
        <p>
          仅监听 127.0.0.1。渲染、原生前端与 HMR 分别使用端口
          +1、+2、+3；修改端口后需重启。
        </p>
        <label>
          Cargo 启动参数（JSON 数组）
          <input
            aria-label="Cargo 启动参数"
            value={cargo}
            disabled={busy}
            onChange={(event) => setCargo(event.target.value)}
            placeholder={'["--locked", "-j", "4"]'}
          />
        </label>
        <label>
          应用启动参数（JSON 数组）
          <input
            aria-label="应用启动参数"
            value={args}
            disabled={busy}
            onChange={(event) => setArgs(event.target.value)}
            placeholder={'["--example"]'}
          />
        </label>
        <label>
          环境变量（JSON 对象）
          <textarea
            aria-label="启动环境变量"
            value={env}
            disabled={busy}
            onChange={(event) => setEnv(event.target.value)}
            rows={4}
          />
        </label>
        <p>调试 feature、数据目录、凭据和插件隔离由 Debugger 管理。</p>
        {info && (
          <details>
            <summary>当前接口与存储位置</summary>
            <dl>
              <dt>API</dt>
              <dd>{info.endpoints.service}/api</dd>
              <dt>场景渲染器</dt>
              <dd>{info.endpoints.renderer}</dd>
              <dt>原生前端</dt>
              <dd>{info.endpoints.nativeFrontend}</dd>
              <dt>记录目录</dt>
              <dd>{info.dataDirectory}</dd>
              <dt>配置文件</dt>
              <dd>{info.dataDirectory}/project.json</dd>
            </dl>
          </details>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="form-success">
            {message}
          </p>
        )}
      </div>
      <footer>
        <button
          className="action"
          disabled={busy || !info}
          onClick={() => void submit(false)}
        >
          检查项目
        </button>
        <button
          className="action primary"
          disabled={busy || !info}
          onClick={() => void submit(true)}
        >
          {busy ? "处理中…" : "保存并应用"}
        </button>
      </footer>
    </dialog>,
    locale,
  );
}
