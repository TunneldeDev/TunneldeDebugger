import {
  ACCEPTANCE_RESULTS,
  ACCEPTANCE_PRIORITIES,
} from "../shared/acceptance";
import { ImagePreview } from "./image-preview";
import { Select } from "./select";
import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import { api } from "./api";
import { EvidenceEditor } from "./evidence-editor";
import { localize } from "./i18n";
import type {
  AcceptanceRecord,
  ScenarioDefinition,
  ScenarioParameters,
  SourceIdentity,
  TargetKind,
} from "../shared/protocol";
const statuses = ACCEPTANCE_RESULTS;
const targetNames = {
  browser: "浏览器",
  "native-mock": "界面模拟",
  "native-service": "真实服务",
};
const presetNames = {
  normal: "常规数据",
  empty: "空数据",
  loading: "加载中",
  error: "失败状态",
  boundary: "边界数据",
  disabled: "禁用状态",
};
interface Draft {
  title: string;
  note: string;
  steps: string;
  expected: string;
  status: AcceptanceRecord["status"];
  priority: NonNullable<AcceptanceRecord["priority"]>;
  screenshots: string[];
  checklist: string[];
  editing?: AcceptanceRecord;
}
const empty = (): Draft => ({
  title: "",
  note: "",
  steps: "",
  expected: "",
  status: "failed",
  priority: "P2",
  screenshots: [],
  checklist: [],
});
function readDraft(key: string): Draft {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    if (
      value &&
      typeof value.note === "string" &&
      typeof value.title === "string" &&
      Array.isArray(value.screenshots) &&
      Array.isArray(value.checklist) &&
      value.status in statuses
    )
      return { ...value, priority: value.priority ?? "P2" };
  } catch {
    /* Show a fresh form when old browser data cannot be decoded. */
  }
  return empty();
}
export function AcceptancePanel({
  scene,
  parameters,
  target,
  source,
  ticket,
  generation,
  records,
  captureRequest,
  capture,
  onCaptureFinished,
  canCapture,
  canPass,
  locale,
  refresh,
}: {
  scene: ScenarioDefinition;
  parameters: ScenarioParameters;
  target: TargetKind;
  source: SourceIdentity;
  ticket?: string;
  generation: number;
  records: AcceptanceRecord[];
  captureRequest: number;
  capture: () => Promise<string>;
  onCaptureFinished: () => void;
  canCapture: boolean;
  canPass: boolean;
  locale: "zh-CN" | "en-US";
  refresh: () => Promise<unknown>;
}) {
  const key = `tunnelde:acceptance:v2:${source.path}:${source.revision}:${source.dirtyFingerprint}:${scene.id}:${target}:${JSON.stringify(parameters)}`;
  const [draft, setDraft] = useState<Draft>(() => readDraft(key));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [draftError, setDraftError] = useState("");
  const [annotate, setAnnotate] = useState<string>();
  const [trash, setTrash] = useState(false);
  const [trashed, setTrashed] = useState<AcceptanceRecord[]>([]);
  const [preview, setPreview] = useState<{
    images: string[];
    initial: number;
  }>();
  const loadTrash = async () =>
    setTrashed(await api<AcceptanceRecord[]>("acceptance/trash"));
  useEffect(() => {
    if (trash) void work(loadTrash);
  }, [trash]);
  const [all, setAll] = useState(false);
  const [query, setQuery] = useState("");
  const uploadInput = useRef<HTMLInputElement>(null);
  const requestSeen = useRef(captureRequest);
  const locked = useRef(false);
  const persistAttachment = (artifact: string) => {
    if (mounted.current)
      setDraft((previous) => ({
        ...previous,
        screenshots: [...previous.screenshots, artifact],
      }));
    else {
      const stored = readDraft(key);
      localStorage.setItem(
        key,
        JSON.stringify({
          ...stored,
          screenshots: [...stored.screenshots, artifact],
        }),
      );
    }
  };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(draft));
      setDraftError("");
    } catch {
      setDraftError(
        "草稿未能写入浏览器，请立即保存记录 / Draft storage failed; save the record now",
      );
    }
  }, [draft, key]);
  const change = (patch: Partial<Draft>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setMessage("");
  };
  const context = draft.editing ?? {
    scenarioId: scene.id,
    parameters,
    target,
    source,
  };
  const sameContext =
    context.scenarioId === scene.id &&
    context.target === target &&
    JSON.stringify(context.parameters) === JSON.stringify(parameters) &&
    context.source.dirtyFingerprint === source.dirtyFingerprint &&
    context.source.revision === source.revision &&
    context.source.path === source.path;
  const work = async (action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (cause) {
      if (mounted.current)
        setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const attach = async (image: string) => {
    const result = await api<{ artifact: string }>("attachments", {
      ...context,
      recordId: draft.editing?.id,
      ticket,
      image,
    });
    persistAttachment(result.artifact);
  };
  const takeCapture = () =>
    work(async () => {
      try {
        if (!canCapture || !sameContext)
          throw new Error(
            "当前场景无法截图，可上传或粘贴图片 / Cannot capture this scene; attach an image instead",
          );
        if (draft.screenshots.length >= 20)
          throw new Error("最多附加 20 张图片 / Maximum 20 images");
        const artifact = await capture();
        persistAttachment(artifact);
        if (mounted.current) setMessage("截图已加入草稿，请保存记录");
      } finally {
        if (mounted.current) onCaptureFinished();
      }
    });
  useEffect(() => {
    if (captureRequest !== requestSeen.current) {
      requestSeen.current = captureRequest;
      void takeCapture();
    }
  }, [captureRequest]);
  const upload = (files: File[]) =>
    work(async () => {
      if (draft.screenshots.length + files.length > 20)
        throw new Error("最多附加 20 张图片 / Maximum 20 images");
      for (const file of files) {
        if (
          !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
          file.size > 10 * 1024 * 1024
        )
          throw new Error(
            "请选择不超过 10 MiB 的 PNG、JPEG 或 WebP 图片 / Choose PNG, JPEG or WebP up to 10 MiB",
          );
        const url = URL.createObjectURL(file);
        try {
          const img = new Image();
          img.src = url;
          await img.decode();
          const factor = Math.min(1, 4096 / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * factor));
          canvas.height = Math.max(1, Math.round(img.height * factor));
          canvas
            .getContext("2d")!
            .drawImage(img, 0, 0, canvas.width, canvas.height);
          await attach(canvas.toDataURL("image/png"));
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      if (mounted.current) setMessage("图片已加入草稿，请保存记录");
    });
  const paste = (event: ClipboardEvent) => {
    const files = Array.from(event.clipboardData.files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (files.length) {
      event.preventDefault();
      void upload(files);
    }
  };
  const save = () =>
    work(async () => {
      await api<AcceptanceRecord>("acceptance", {
        ...context,
        ...draft,
        id: draft.editing?.id,
        expectedUpdatedAt: draft.editing?.updatedAt,
        ticket,
        generation,
      });
      if (!mounted.current) {
        localStorage.removeItem(key);
        await refresh();
        return;
      }
      setDraft(draft.editing ? readDraft(`${key}:new`) : empty());
      if (draft.editing)
        localStorage.removeItem(`${key}:edit:${draft.editing.id}`);
      localStorage.removeItem(`${key}:new`);
      setMessage(draft.editing ? "修改已保存" : "记录已保存");
      await refresh();
    });
  const edit = (record: AcceptanceRecord) => {
    try {
      if (!draft.editing)
        localStorage.setItem(`${key}:new`, JSON.stringify(draft));
      else
        localStorage.setItem(
          `${key}:edit:${draft.editing.id}`,
          JSON.stringify(draft),
        );
    } catch {
      setError(
        "无法保留当前草稿，请先保存 / Could not retain the current draft; save it first",
      );
      return;
    }
    const savedEdit = readDraft(`${key}:edit:${record.id}`);
    setDraft(
      savedEdit.editing?.updatedAt === record.updatedAt
        ? savedEdit
        : {
            title: record.title ?? "",
            note: record.note,
            steps: record.steps ?? "",
            expected: record.expected ?? "",
            status: record.status,
            priority: record.priority ?? "P2",
            screenshots: record.screenshots,
            checklist: record.checklist ?? [],
            editing: record,
          },
    );
    setError("");
    setMessage("");
  };
  const back = () => {
    if (draft.editing)
      localStorage.setItem(
        `${key}:edit:${draft.editing.id}`,
        JSON.stringify(draft),
      );
    setDraft(readDraft(`${key}:new`));
    setMessage("");
    setError("");
  };
  const visible = (trash ? trashed : records)
    .filter(
      (record) =>
        (trash || all || record.scenarioId === scene.id) &&
        (!query ||
          `${record.title ?? ""} ${record.note} ${record.scenarioId}`
            .toLowerCase()
            .includes(query.toLowerCase())),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return localize(
    <section className="acceptance-panel" onPaste={paste}>
      <div className="acceptance-editor-heading">
        <h2>{draft.editing ? "编辑记录" : "记录问题"}</h2>
        {draft.editing && (
          <button className="action" disabled={busy} onClick={back}>
            返回新记录
          </button>
        )}
      </div>
      <div
        className="record-context"
        title={`${context.source.path} · ${context.source.revision} · ${context.source.dirtyFingerprint}`}
      >
        {draft.editing ? draft.editing.scenarioId : scene.title} ·{" "}
        {targetNames[context.target]} · {presetNames[context.parameters.preset]}
      </div>
      {draftError ? (
        <p role="alert" className="form-error">
          {draftError}
        </p>
      ) : (
        <p className="draft-hint">草稿自动保留，切换场景后可继续填写</p>
      )}
      <div className="acceptance-save">
        <label>
          结论
          <Select
            aria-label="验收结论"
            disabled={busy}
            value={draft.status}
            onChange={(event) =>
              change({ status: event.target.value as Draft["status"] })
            }
          >
            {Object.entries(statuses).map(([value, label]) => (
              <option
                key={value}
                value={value}
                disabled={
                  value === "passed" &&
                  !(canPass && sameContext) &&
                  draft.editing?.status !== "passed"
                }
              >
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label>
          优先级
          <Select
            aria-label="问题优先级"
            value={draft.priority}
            disabled={busy}
            onChange={(event) =>
              change({ priority: event.target.value as Draft["priority"] })
            }
          >
            {Object.entries(ACCEPTANCE_PRIORITIES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <button
          className="action primary"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? "处理中…" : draft.editing ? "保存修改" : "保存记录"}
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      <label className="acceptance-field">
        问题标题
        <input
          aria-label="问题标题"
          value={draft.title}
          maxLength={200}
          disabled={busy}
          onChange={(event) => change({ title: event.target.value })}
          placeholder="例如：窄窗口下保存按钮被遮挡"
        />
      </label>
      <label className="acceptance-field">
        问题描述
        <textarea
          aria-label="验收备注"
          value={draft.note}
          maxLength={20000}
          disabled={busy}
          onChange={(event) => change({ note: event.target.value })}
          rows={4}
          placeholder="记录具体问题，也可以直接粘贴截图"
        />
      </label>
      <details className="acceptance-extra">
        <summary>复现步骤与预期结果</summary>
        <label className="acceptance-field">
          复现步骤
          <textarea
            aria-label="复现步骤"
            rows={3}
            value={draft.steps}
            disabled={busy}
            onChange={(event) => change({ steps: event.target.value })}
          />
        </label>
        <label className="acceptance-field">
          预期结果
          <textarea
            aria-label="预期结果"
            rows={2}
            value={draft.expected}
            disabled={busy}
            onChange={(event) => change({ expected: event.target.value })}
          />
        </label>
      </details>
      <div className="attachment-actions">
        <button
          className="action"
          disabled={
            busy ||
            !canCapture ||
            !sameContext ||
            draft.screenshots.length >= 20
          }
          title={
            !canCapture || !sameContext
              ? "无法截图时可上传或粘贴图片"
              : "截取可见画面；浏览器中请选择此标签页"
          }
          onClick={() => void takeCapture()}
        >
          截取当前界面
        </button>
        <button
          className="action"
          disabled={busy || draft.screenshots.length >= 20}
          onClick={() => uploadInput.current?.click()}
        >
          上传图片
        </button>
        <input
          ref={uploadInput}
          hidden
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          aria-label="上传验收图片"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length) void upload(files);
          }}
        />
      </div>
      <div
        className="attachment-list"
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files"))
            event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          void upload(Array.from(event.dataTransfer.files));
        }}
      >
        {!draft.screenshots.length && (
          <p className="attachment-empty">可上传、粘贴或拖入图片</p>
        )}
        {draft.screenshots.map((name, index) => (
          <figure className="attachment" key={name}>
            <button
              type="button"
              className="image-thumbnail"
              aria-label={`预览截图 ${index + 1}`}
              onClick={() =>
                setPreview({ images: draft.screenshots, initial: index })
              }
            >
              <img src={`/artifacts/${name}`} alt={`验收截图 ${index + 1}`} />
            </button>
            <figcaption>
              <span>截图 {index + 1}</span>
              <a href={`/artifacts/${name}`} download={name}>
                下载
              </a>
              <button disabled={busy} onClick={() => setAnnotate(name)}>
                标注
              </button>
              <button
                disabled={busy}
                aria-label={`移除截图 ${index + 1}`}
                onClick={() =>
                  change({
                    screenshots: draft.screenshots.filter(
                      (value) => value !== name,
                    ),
                  })
                }
              >
                移除
              </button>
            </figcaption>
          </figure>
        ))}
      </div>
      <details className="acceptance-extra" hidden={!sameContext}>
        <summary>检查清单</summary>
        <div className="checklist">
          {scene.checklist.map((item) => (
            <label key={item}>
              <input
                type="checkbox"
                disabled={busy}
                checked={draft.checklist.includes(item)}
                onChange={(event) =>
                  change({
                    checklist: event.target.checked
                      ? [...draft.checklist, item]
                      : draft.checklist.filter((value) => value !== item),
                  })
                }
              />
              {item}
            </label>
          ))}
        </div>
      </details>
      <div className="acceptance-history-heading">
        <h2>{trash ? "回收站" : "验收记录"}</h2>
        <button className="action" onClick={() => setTrash(!trash)}>
          {trash ? "返回记录" : "回收站"}
        </button>
        <label>
          <input
            type="checkbox"
            checked={all}
            onChange={(event) => setAll(event.target.checked)}
          />
          全部场景
        </label>
      </div>
      <input
        className="history-search"
        aria-label="搜索验收记录"
        placeholder="搜索标题或问题描述"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {!visible.length && <p className="draft-hint">暂无验收记录</p>}
      {visible.map((record) => (
        <article className="acceptance-entry" key={record.id}>
          <div>
            <span className={`run-status ${record.status}`}>
              {statuses[record.status]}
            </span>
            <span className={`priority priority-${record.priority ?? "P2"}`}>
              {record.priority ?? "P2"}
            </span>
            <strong>{record.title || record.scenarioId}</strong>
          </div>
          <p>{record.note || "无文字说明"}</p>
          {record.steps && <p>复现步骤：{record.steps}</p>}
          {record.expected && <p>预期结果：{record.expected}</p>}
          <div className="history-thumbnails">
            {record.screenshots.map((name, index) => (
              <button
                type="button"
                className="image-thumbnail"
                key={name}
                aria-label={`预览历史截图 ${index + 1}`}
                onClick={() =>
                  setPreview({ images: record.screenshots, initial: index })
                }
              >
                <img src={`/artifacts/${name}`} alt={`历史截图 ${index + 1}`} />
              </button>
            ))}
          </div>
          <small>
            {record.scenarioId} · {targetNames[record.target]} ·{" "}
            {presetNames[record.parameters.preset]} ·{" "}
            {record.source.revision.slice(0, 7)}
          </small>
          <time>{new Date(record.updatedAt).toLocaleString(locale)}</time>
          <div className="history-actions">
            {trash ? (
              <button
                className="action"
                disabled={busy}
                onClick={() =>
                  void work(async () => {
                    await api(`acceptance/${record.id}/restore`, {});
                    await loadTrash();
                    await refresh();
                    setMessage("记录已恢复");
                  })
                }
              >
                恢复记录
              </button>
            ) : (
              <>
                <button
                  className="action"
                  disabled={busy}
                  onClick={() => edit(record)}
                >
                  编辑
                </button>
                <button
                  className="action"
                  disabled={busy}
                  onClick={() =>
                    void work(async () => {
                      await api(`acceptance/${record.id}/delete`, {
                        expectedUpdatedAt: record.updatedAt,
                      });
                      if (draft.editing?.id === record.id) back();
                      await refresh();
                      setMessage("记录已移入回收站");
                    })
                  }
                >
                  删除
                </button>
              </>
            )}
          </div>
        </article>
      ))}
      {preview && (
        <ImagePreview
          {...preview}
          locale={locale}
          onClose={() => setPreview(undefined)}
        />
      )}
      {annotate && (
        <EvidenceEditor
          name={annotate}
          locale={locale}
          onClose={() => setAnnotate(undefined)}
          onSave={async (image) => {
            const result = await api<{ artifact: string }>("attachments", {
              ...context,
              recordId: draft.editing?.id,
              ticket,
              image,
            });
            change({
              screenshots: draft.screenshots.map((name) =>
                name === annotate ? result.artifact : name,
              ),
            });
          }}
        />
      )}
    </section>,
    locale,
  );
}
