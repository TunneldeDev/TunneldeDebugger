import { test as base, expect } from "@playwright/test";

// Feed actual compositor pixels into the display-media boundary. Browser permission
// pickers are OS UI and unavailable in headless Chromium/WebKit. No DOM renderer.
declare global {
  interface Window {
    captureTestPixels(): Promise<string>;
    captureTestState: {
      handle: string;
      tracks: MediaStreamTrack[];
      image?: string;
    };
  }
}
export const test = base.extend({
  page: async ({ page, browserName }, use) => {
    await page.exposeFunction("captureTestPixels", async () =>
      (await page.screenshot({ caret: "initial" })).toString("base64"),
    );
    await page.addInitScript((native) => {
      if (window !== top) return;
      const state = { handle: "", tracks: [] as MediaStreamTrack[] };
      Object.assign(window, { captureTestState: state });
      if (native) {
        Object.assign(window, {
          isTauri: true,
          __TAURI_INTERNALS__: {
            invoke: async (command: string) => {
              if (command !== "capture_workbench")
                throw new Error("Unexpected native command");
              const pixels = await window.captureTestPixels();
              window.captureTestState.image = pixels;
              return `data:image/png;base64,${pixels}`;
            },
          },
        });
        return;
      }
      if (!navigator.mediaDevices)
        Object.defineProperty(navigator, "mediaDevices", { value: {} });
      Object.defineProperty(navigator.mediaDevices, "setCaptureHandleConfig", {
        configurable: true,
        value: (config: { handle: string }) => {
          state.handle = config.handle;
        },
      });
      Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
        configurable: true,
        value: async () => {
          const data = await window.captureTestPixels();
          window.captureTestState.image = data;
          const image = new Image();
          image.src = `data:image/png;base64,${data}`;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          canvas.getContext("2d")!.drawImage(image, 0, 0);
          const stream = canvas.captureStream(30);
          const track = stream.getVideoTracks()[0]!;
          const settings = track.getSettings();
          Object.assign(track, {
            getSettings: () => ({ ...settings, displaySurface: "browser" }),
            getCaptureHandle: () => ({ handle: state.handle }),
          });
          state.tracks.push(track);
          return stream;
        },
      });
    }, browserName === "webkit");
    await use(page);
  },
});
export { expect };
