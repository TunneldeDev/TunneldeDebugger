import { test, expect } from "./capture-fixture";
import { selectOption } from "./helpers";

async function open(page: import("@playwright/test").Page) {
  await page.goto("/?scene=forms");
  await expect(page.getByTestId("scene-ready")).toBeVisible();
  await page.getByRole("button", { name: "记录问题", exact: true }).click();
}

test("captures compositor styles at visible zoom and releases sharing tracks", async ({
  page,
}) => {
  await open(page);
  await selectOption(page.getByLabel("预览缩放"), "0.5");
  await page
    .frameLocator("iframe")
    .locator("body")
    .evaluate((body) => {
      const sample = document.createElement("div");
      sample.textContent = "像素 evidence 🧪";
      sample.style.cssText =
        "position:fixed;left:70px;top:150px;width:200px;height:70px;color:white;background:#c024da;box-shadow:0 10px 20px #0008;transform:rotate(8deg);border-radius:20px;z-index:99999";
      body.append(sample);
    });
  const frameBox = (await page.locator("iframe").boundingBox())!;
  await page.getByRole("button", { name: "截取当前界面", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("截图已加入草稿");
  const url = await page.locator(".attachment img").getAttribute("src");
  const response = await page.request.get(url!);
  const image = await response.body();
  expect(Math.abs(image.readUInt32BE(16) - frameBox.width)).toBeLessThanOrEqual(
    2,
  );
  expect(
    Math.abs(image.readUInt32BE(20) - frameBox.height),
  ).toBeLessThanOrEqual(2);
  const difference = await page.evaluate(
    async ({ data, box }) => {
      const load = async (src: string) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        return image;
      };
      const source = await load(
        `data:image/png;base64,${window.captureTestState.image}`,
      );
      const actual = await load(data);
      const canvas = document.createElement("canvas");
      canvas.width = actual.naturalWidth;
      canvas.height = actual.naturalHeight;
      const context = canvas.getContext("2d")!;
      const x = Math.ceil(box.x),
        y = Math.ceil(box.y);
      context.drawImage(
        source,
        x,
        y,
        canvas.width,
        canvas.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const expected = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(actual, 0, 0);
      const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      let difference = 0;
      for (let i = 0; i < pixels.length; i++)
        difference += Math.abs(pixels[i]! - expected[i]!);
      return difference / pixels.length;
    },
    {
      data: `data:image/png;base64,${image.toString("base64")}`,
      box: frameBox,
    },
  );
  // The Chromium video transport performs a color-space conversion; the native
  // image boundary is lossless. Both must retain the actual composited styles.
  expect(difference).toBeLessThan(2);
  expect(
    await page.evaluate(() =>
      window.captureTestState.tracks.every(
        (t: MediaStreamTrack) => t.readyState === "ended",
      ),
    ),
  ).toBe(true);
});

test("captures only the visible part after zooming and panning", async ({
  page,
}) => {
  await open(page);
  await selectOption(page.getByLabel("预览缩放"), "1.25");
  const heading = page.locator(".frame-chrome");
  const box = (await heading.boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x - 100, box.y - 80);
  await page.mouse.up();
  const frameBox = (await page.locator("iframe").boundingBox())!;
  await page.getByRole("button", { name: "截取当前界面", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("截图已加入草稿");
  const url = await page.locator(".attachment img").getAttribute("src");
  const image = await (await page.request.get(url!)).body();
  expect(image.readUInt32BE(16)).toBeLessThan(frameBox.width);
  expect(image.readUInt32BE(20)).toBeLessThan(frameBox.height);
});

test("denied permission preserves the issue without attaching evidence", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Display sharing is Chrome/Edge only");
  await open(page);
  await page.getByLabel("验收备注").fill("Keep the reported issue");
  await page.evaluate(() =>
    Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
      value: () =>
        Promise.reject(
          new DOMException("Permission denied", "NotAllowedError"),
        ),
    }),
  );
  await page.getByRole("button", { name: "截取当前界面", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("截图已取消或未授权");
  await expect(page.getByLabel("验收备注")).toHaveValue(
    "Keep the reported issue",
  );
  await expect(page.locator(".attachment img")).toHaveCount(0);
});

test("rejects a different tab and stops all of its tracks", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Display sharing is Chrome/Edge only");
  await open(page);
  await page.evaluate(() => {
    const devices = navigator.mediaDevices;
    const original = devices.getDisplayMedia.bind(devices);
    Object.defineProperty(devices, "getDisplayMedia", {
      value: async () => {
        const stream = await original();
        Object.assign(stream.getVideoTracks()[0]!, {
          getCaptureHandle: () => ({ handle: "another-tab" }),
        });
        return stream;
      },
    });
  });
  await page.getByRole("button", { name: "截取当前界面", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "请选择当前 Debugger 标签页",
  );
  await expect(page.locator(".attachment img")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      window.captureTestState.tracks.every(
        (t: MediaStreamTrack) => t.readyState === "ended",
      ),
    ),
  ).toBe(true);
});

test("does not silently fall back to DOM capture on an unsupported browser", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Display sharing is Chrome/Edge only");
  await open(page);
  await page.evaluate(() =>
    Object.defineProperty(navigator.mediaDevices, "setCaptureHandleConfig", {
      value: undefined,
    }),
  );
  await page.getByRole("button", { name: "截取当前界面", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "请使用 Chrome/Edge 或 Debugger 桌面版",
  );
  await expect(page.locator(".attachment img")).toHaveCount(0);
});

test("toolbar capture reads pixels before opening the inspector changes the canvas", async ({
  page,
}) => {
  await page.goto("/?scene=forms");
  await expect(page.getByTestId("scene-ready")).toBeVisible();
  await expect(page.locator("#inspector")).toBeHidden();
  const box = (await page.locator("iframe").boundingBox())!;
  await page.getByRole("button", { name: "截图", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("截图已加入草稿");
  await expect(page.locator("#inspector")).toBeVisible();
  const url = await page.locator(".attachment img").getAttribute("src");
  const image = await (await page.request.get(url!)).body();
  expect(Math.abs(image.readUInt32BE(16) - box.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(image.readUInt32BE(20) - box.height)).toBeLessThanOrEqual(2);
});
