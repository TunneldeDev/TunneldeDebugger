import { useEffect, useRef, useState } from "react";
import { localize } from "./i18n";
export function ImagePreview({
  images,
  initial,
  locale,
  onClose,
}: {
  images: string[];
  initial: number;
  locale: "zh-CN" | "en-US";
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(initial);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [error, setError] = useState("");
  const [natural, setNatural] = useState(1280);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const image = images[index]!;
  return localize(
    <dialog
      ref={dialog}
      className="image-preview"
      aria-label="图片预览"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <strong>图片预览</strong>
        <span>
          {index + 1} / {images.length}
        </span>
        <button
          className="action"
          disabled={index === 0}
          onClick={() => {
            setIndex(index - 1);
            setError("");
          }}
        >
          上一张
        </button>
        <button
          className="action"
          disabled={index === images.length - 1}
          onClick={() => {
            setIndex(index + 1);
            setError("");
          }}
        >
          下一张
        </button>
        <button className="action" onClick={() => setZoom("fit")}>
          适应窗口
        </button>
        <button className="action" onClick={() => setZoom(1)}>
          原始尺寸
        </button>
        <button
          className="action"
          aria-label="缩小图片"
          onClick={() =>
            setZoom(Math.max(0.1, (zoom === "fit" ? 1 : zoom) - 0.25))
          }
        >
          −
        </button>
        <button
          className="action"
          aria-label="放大图片"
          onClick={() =>
            setZoom(Math.min(4, (zoom === "fit" ? 1 : zoom) + 0.25))
          }
        >
          +
        </button>
        <button className="action" aria-label="关闭预览" onClick={onClose}>
          ×
        </button>
      </header>
      <div className={`image-preview-body ${zoom === "fit" ? "fit" : ""}`}>
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <img
            src={`/artifacts/${image}`}
            alt="验收截图"
            style={
              zoom === "fit"
                ? undefined
                : { width: natural * zoom, maxWidth: "none", maxHeight: "none" }
            }
            onLoad={(event) => setNatural(event.currentTarget.naturalWidth)}
            onError={() => setError("图片读取失败 / Could not load image")}
          />
        )}
      </div>
    </dialog>,
    locale,
  );
}
