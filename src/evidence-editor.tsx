import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { localize } from "./i18n";
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function EvidenceEditor({
  name,
  locale,
  onSave,
  onClose,
}: {
  name: string;
  locale: "zh-CN" | "en-US";
  onSave: (image: string) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [size, setSize] = useState({ width: 1280, height: 800 });
  const [rects, setRects] = useState<Rect[]>([]);
  const [active, setActive] = useState<Rect>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const start = useRef<{ x: number; y: number } | undefined>(undefined);
  const image = useRef<HTMLImageElement | undefined>(undefined);
  const point = (event: ReactPointerEvent<SVGSVGElement>) => {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const location = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    );
    return {
      x: Math.max(0, Math.min(size.width, location.x)),
      y: Math.max(0, Math.min(size.height, location.y)),
    };
  };
  useEffect(() => {
    dialog.current?.showModal();
    const img = new Image();
    img.onload = () => {
      image.current = img;
      setSize({ width: img.width, height: img.height });
    };
    img.onerror = () => setError("无法读取图片 / Could not load image");
    img.src = `/artifacts/${name}`;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [name]);
  const save = async () => {
    if (!image.current) return;
    setBusy(true);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image.current, 0, 0);
      ctx.lineWidth = Math.max(3, Math.round(size.width / 400));
      ctx.strokeStyle = "#ff4545";
      for (const [index, rect] of rects.entries()) {
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        const labelSize = Math.max(20, Math.round(size.width / 45));
        ctx.fillStyle = "#d92f3a";
        ctx.fillRect(rect.x, rect.y, labelSize, labelSize);
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${labelSize * 0.7}px sans-serif`;
        ctx.fillText(
          String(index + 1),
          rect.x + labelSize * 0.25,
          rect.y + labelSize * 0.77,
        );
      }
      await onSave(canvas.toDataURL("image/png"));
      onClose();
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  };
  return localize(
    <dialog
      ref={dialog}
      className="evidence-dialog"
      aria-label="标注截图"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header>
        <strong>标注截图</strong>
        <span>拖动框出问题位置</span>
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          aria-label="关闭标注"
        >
          ×
        </button>
      </header>
      <div className="evidence-scroll">
        <svg
          aria-label="截图标注画布"
          viewBox={`0 0 ${size.width} ${size.height}`}
          onPointerDown={(event) => {
            if (busy || !image.current) return;
            start.current = point(event);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!start.current) return;
            const { x, y } = point(event);
            setActive({
              x: Math.min(x, start.current.x),
              y: Math.min(y, start.current.y),
              width: Math.abs(x - start.current.x),
              height: Math.abs(y - start.current.y),
            });
          }}
          onPointerUp={() => {
            if (active && active.width > 4 && active.height > 4)
              setRects((previous) => [...previous, active]);
            start.current = undefined;
            setActive(undefined);
          }}
          onPointerCancel={() => {
            start.current = undefined;
            setActive(undefined);
          }}
        >
          <image
            href={`/artifacts/${name}`}
            width={size.width}
            height={size.height}
          />
          {[...rects, ...(active ? [active] : [])].map((rect, index) => (
            <g key={index}>
              <rect
                {...rect}
                fill="none"
                stroke="#ff4545"
                strokeWidth={Math.max(3, size.width / 400)}
              />
              <text
                x={rect.x + 5}
                y={rect.y + Math.max(20, size.width / 45)}
                fill="#ff4545"
                fontSize={Math.max(20, size.width / 45)}
              >
                {index + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>
      {error && <p role="alert">{error}</p>}
      <footer>
        <button
          className="action"
          disabled={busy || !rects.length}
          onClick={() => setRects((previous) => previous.slice(0, -1))}
        >
          撤销标记
        </button>
        <button className="action" disabled={busy} onClick={onClose}>
          取消
        </button>
        <button
          className="action primary"
          disabled={busy || !rects.length}
          onClick={() => void save()}
        >
          {busy ? "保存中…" : "保存标注"}
        </button>
      </footer>
    </dialog>,
    locale,
  );
}
