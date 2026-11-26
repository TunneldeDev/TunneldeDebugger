import { writeFile } from "node:fs/promises";
import { type Page, type TestInfo } from "@playwright/test";
import { test, expect } from "./capture-fixture";

test("capture preserves the visible scrolled settings and leaves the live scene unchanged", async ({
  page,
}, testInfo) => {
  await page.goto("/?scene=settings-terminal");
  await expect(page.getByTestId("scene-ready")).toBeVisible();
  await page.getByRole("button", { name: "记录问题", exact: true }).click();
  const frame = page.frameLocator("iframe");
  const scroller = frame.locator(".settings__body");
  await scroller.evaluate(async (node) => {
    await node.ownerDocument.fonts.ready;
    node.scrollTop = 400;
  });
  const position = await scroller.evaluate((node) => {
    const viewport = node.getBoundingClientRect();
    const row = [...node.querySelectorAll<HTMLElement>(".settings-row")].find(
      (row) => {
        const rect = row.getBoundingClientRect();
        return rect.top > viewport.top + 5 && rect.bottom < viewport.bottom - 5;
      },
    )!;
    row.style.boxShadow = "inset 0 0 0 8px rgb(251, 17, 211)";
    const box = row.getBoundingClientRect();
    return {
      top: node.scrollTop,
      x: Math.floor(box.right - 4),
      y: Math.floor(box.top + box.height / 2),
    };
  });
  expect(position.top).toBeGreaterThan(0);
  const frameSrc = await page.locator("iframe").getAttribute("src");
  const pixel = await capturePixel(page, position, testInfo);
  await expect(page.locator("iframe")).toHaveAttribute("src", frameSrc!);
  expect(await scroller.evaluate((node) => node.scrollTop)).toBe(position.top);
  // Display-media video can round color channels during pixel transport.
  [251, 17, 211, 255].forEach((value, channel) =>
    expect(Math.abs(pixel[channel]! - value)).toBeLessThanOrEqual(5),
  );
});

test("capture preserves both axes of the production editor scroller", async ({
  page,
}, testInfo) => {
  await page.goto("/?scene=editor");
  await expect(page.getByTestId("scene-ready")).toBeVisible();
  const frame = page.frameLocator("iframe");
  await frame
    .locator(".cm-content")
    .fill(
      Array.from(
        { length: 80 },
        (_, i) => `Line ${i}: ${"scroll evidence ".repeat(40)}`,
      ).join("\n"),
    );
  await page.getByRole("button", { name: "记录问题", exact: true }).click();
  const scroller = frame.locator(".cm-scroller");
  await scroller.evaluate((node) => {
    node.scrollTop = 500;
    node.scrollLeft = 250;
  });
  await expect
    .poll(() => scroller.evaluate((node) => node.scrollLeft))
    .toBeGreaterThan(0);
  // Let CodeMirror update its viewport after scrolling before marking a visible line.
  await expect
    .poll(() =>
      scroller.evaluate((node) => {
        const box = node.getBoundingClientRect();
        return [...node.querySelectorAll(".cm-line")].filter((line) => {
          const row = line.getBoundingClientRect();
          return row.top > box.top + 5 && row.bottom < box.bottom - 5;
        }).length;
      }),
    )
    .toBeGreaterThan(0);
  const position = await scroller.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const row = [...node.querySelectorAll<HTMLElement>(".cm-line")].find(
      (line) => {
        const rect = line.getBoundingClientRect();
        return rect.top > box.top + 5 && rect.bottom < box.bottom - 5;
      },
    )!;
    row.style.backgroundImage =
      "linear-gradient(90deg, rgb(7, 233, 101) 160px, rgb(251, 17, 211) 160px)";
    const rect = row.getBoundingClientRect();
    return {
      top: node.scrollTop,
      left: node.scrollLeft,
      x: Math.floor(box.left + 100),
      y: Math.floor(rect.top + 1),
    };
  });
  expect(position.top).toBeGreaterThan(0);
  const pixel = await capturePixel(page, position, testInfo);
  expect(
    await scroller.evaluate((node) => ({
      top: node.scrollTop,
      left: node.scrollLeft,
    })),
  ).toEqual({ top: position.top, left: position.left });
  // Display-media video can round color channels during pixel transport.
  [251, 17, 211, 255].forEach((value, channel) =>
    expect(Math.abs(pixel[channel]! - value)).toBeLessThanOrEqual(5),
  );
});

async function capturePixel(
  page: Page,
  point: { x: number; y: number },
  info: TestInfo,
) {
  const capturePoint = await page.locator("iframe").evaluate((frame, point) => {
    const rect = frame.getBoundingClientRect();
    return {
      x: Math.floor(
        (point.x * rect.width) / (frame as HTMLIFrameElement).clientWidth,
      ),
      y: Math.floor(
        (point.y * rect.height) / (frame as HTMLIFrameElement).clientHeight,
      ),
    };
  }, point);
  await page.getByRole("button", { name: "截取当前界面", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("截图已加入草稿", {
    timeout: 30000,
  });
  const artifact = await page
    .locator(".attachment img")
    .last()
    .getAttribute("src");
  const response = await page.request.get(artifact!);
  expect(response.ok()).toBe(true);
  const bytes = await response.body();
  const path = info.outputPath("capture.png");
  await writeFile(path, bytes);
  await info.attach("scrolled-capture", { path, contentType: "image/png" });
  return page.evaluate(
    async ({ data, x, y }) => {
      const image = new Image();
      image.src = data;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      return [...context.getImageData(x, y, 1, 1).data];
    },
    {
      data: `data:image/png;base64,${bytes.toString("base64")}`,
      ...capturePoint,
    },
  );
}
