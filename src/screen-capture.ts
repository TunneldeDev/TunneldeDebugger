import { invoke, isTauri } from "@tauri-apps/api/core";

interface CaptureHandleTrack extends MediaStreamTrack {
  getCaptureHandle?: () => { handle?: string } | null;
}
interface CaptureDevices extends MediaDevices {
  setCaptureHandleConfig?: (config: {
    handle: string;
    permittedOrigins: string[];
  }) => void;
}
const changed = () =>
  new Error("截图期间界面已移动，请重试 / View moved during capture; retry");

// Use viewport coordinates, including CSS zoom/panning and clipping ancestors.
// Never resize or scroll the scene to manufacture invisible evidence.
export function visibleFrameRect(frame: HTMLIFrameElement) {
  const box = frame.getBoundingClientRect();
  let left = Math.max(0, box.left);
  let top = Math.max(0, box.top);
  let right = Math.min(innerWidth, box.right);
  let bottom = Math.min(innerHeight, box.bottom);
  for (let node = frame.parentElement; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    if (/hidden|clip|auto|scroll/.test(style.overflowX)) {
      left = Math.max(left, rect.left);
      right = Math.min(right, rect.right);
    }
    if (/hidden|clip|auto|scroll/.test(style.overflowY)) {
      top = Math.max(top, rect.top);
      bottom = Math.min(bottom, rect.bottom);
    }
  }
  if (right - left < 1 || bottom - top < 1)
    throw new Error(
      "iframe 不在可见区域，请先移动画布 / Move the iframe into view first",
    );
  return {
    left,
    top,
    right,
    bottom,
    viewportWidth: innerWidth,
    viewportHeight: innerHeight,
  };
}

async function displayPixels(): Promise<HTMLCanvasElement> {
  const devices = navigator.mediaDevices as CaptureDevices | undefined;
  if (!devices?.getDisplayMedia || !devices.setCaptureHandleConfig)
    throw new Error(
      "当前浏览器不支持标签页截图，请使用 Chrome/Edge 或 Debugger 桌面版 / Use Chrome/Edge or the desktop app to capture this view",
    );
  const handle = crypto.randomUUID();
  devices.setCaptureHandleConfig({
    handle,
    permittedOrigins: [location.origin],
  });
  let stream: MediaStream | undefined;
  const video = document.createElement("video");
  try {
    // Must run during the user's click activation, before any await.
    stream = await devices.getDisplayMedia({
      video: { displaySurface: "browser" },
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: "include",
      surfaceSwitching: "exclude",
      monitorTypeSurfaces: "exclude",
    } as DisplayMediaStreamOptions);
    const track = stream.getVideoTracks()[0] as CaptureHandleTrack | undefined;
    if (
      !track ||
      track.getSettings().displaySurface !== "browser" ||
      track.getCaptureHandle?.()?.handle !== handle
    )
      throw new Error(
        "请选择当前 Debugger 标签页，不能选择其他标签页、窗口或屏幕 / Select this Debugger tab, not another tab, window or screen",
      );
    video.muted = true;
    video.srcObject = stream;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("屏幕画面读取超时 / Screen capture timed out")),
        10000,
      );
      video.requestVideoFrameCallback(() => {
        clearTimeout(timer);
        resolve();
      });
      void video.play().catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    if (track.readyState !== "live")
      throw new Error("屏幕共享已结束 / Screen sharing ended");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    return canvas;
  } catch (error) {
    if (
      error instanceof DOMException &&
      ["NotAllowedError", "AbortError"].includes(error.name)
    )
      throw new Error(
        "截图已取消或未授权，草稿已保留 / Capture cancelled or denied; draft retained",
      );
    throw error;
  } finally {
    stream?.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  }
}

export async function captureFramePixels(
  frame: HTMLIFrameElement,
): Promise<string> {
  const src = frame.src;
  const before = visibleFrameRect(frame);
  let pixels: HTMLImageElement | HTMLCanvasElement;
  if (isTauri()) {
    pixels = new Image();
    pixels.src = await invoke<string>("capture_workbench");
    await pixels.decode();
  } else {
    pixels = await displayPixels();
  }
  if (!frame.isConnected || frame.src !== src) throw changed();
  const rect = visibleFrameRect(frame);
  if (JSON.stringify(rect) !== JSON.stringify(before)) throw changed();
  const width =
    pixels instanceof HTMLImageElement ? pixels.naturalWidth : pixels.width;
  const height =
    pixels instanceof HTMLImageElement ? pixels.naturalHeight : pixels.height;
  const sx = width / rect.viewportWidth;
  const sy = height / rect.viewportHeight;
  if (!width || !height || Math.abs(sx / sy - 1) > 0.02)
    throw new Error(
      `截图比例与当前窗口不一致 (${width}×${height} / ${rect.viewportWidth}×${rect.viewportHeight})，请重试 / Capture aspect ratio does not match the current viewport`,
    );
  // Keep the captured pixel density, including Retina; do not redraw at scene size.
  const x = Math.ceil(rect.left * sx),
    y = Math.ceil(rect.top * sy);
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(rect.right * sx) - x;
  canvas.height = Math.floor(rect.bottom * sy) - y;
  canvas
    .getContext("2d")!
    .drawImage(
      pixels,
      x,
      y,
      canvas.width,
      canvas.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  return canvas.toDataURL("image/png");
}
