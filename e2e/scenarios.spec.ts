import { selectOption } from "./helpers";
import { test, expect } from "@playwright/test";
import { scenarios } from "../shared/scenarios";
for (const scenario of scenarios) {
  test(`production surface: ${scenario.id}`, async ({ page }) => {
    await page.goto(`/?scene=${scenario.id}`);
    await expect(page.getByTestId("scene-ready")).toBeVisible();
    const frame = page.frameLocator("iframe");
    await expect(
      frame.locator(`[data-debug-surface="${scenario.id}"]`),
    ).toBeVisible();
    await expect(frame.locator("body")).not.toContainText(
      "调试场景未实现此操作",
    );
    await expect(frame.locator("body")).not.toContainText(
      "Cannot read properties",
    );
    await expect(frame.locator("body")).not.toContainText(
      "Something went wrong",
    );
  });
}
test("forms retain input and Escape closes only the dialog", async ({
  page,
}) => {
  await page.goto("/?scene=forms");
  await expect(page.getByTestId("scene-ready")).toBeVisible();
  const frame = page.frameLocator("iframe");
  await frame.getByLabel("名称", { exact: true }).fill("验收输入 🚇");
  await expect(frame.getByLabel("名称", { exact: true })).toHaveValue(
    "验收输入 🚇",
  );
  await frame.getByLabel("名称", { exact: true }).press("Escape");
  await expect(frame.getByRole("dialog")).toHaveCount(0);
  await expect(frame.locator(".app-shell, .app").first()).toBeVisible();
});
test("generation reset, navigation and acceptance persist", async ({
  page,
}) => {
  await page.goto("/?scene=hosts");
  await expect(page.getByTestId("scene-ready")).toBeVisible();
  await page.getByRole("button", { name: "切换检查器", exact: true }).click();
  await page.getByRole("button", { name: "空数据", exact: true }).click();
  await expect(page.getByTestId("scene-ready")).toBeVisible();
  await page.getByRole("button", { name: "下一个场景" }).click();
  await expect(page).toHaveURL(/scene=host-details/);
  await expect(page.getByTestId("scene-ready")).toBeVisible();
  await page.getByRole("button", { name: "记录问题", exact: true }).click();
  await page.getByLabel("验收备注").fill("Playwright acceptance record");
  await selectOption(page.getByLabel("验收结论"), "passed");
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(page.locator(".acceptance-entry").first()).toContainText(
    "Playwright acceptance record",
  );
  await page.reload();
  await page.getByRole("button", { name: "记录问题", exact: true }).click();
  await expect(page.locator(".acceptance-entry").first()).toContainText(
    "Playwright acceptance record",
  );
  const record = page.locator(".acceptance-entry").first();
  await record.getByRole("button", { name: "删除", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "回收站", exact: true }),
  ).toBeVisible();
});
test("narrow disabled forms preserve focus and contain their layout", async ({
  page,
}) => {
  await page.goto("/?scene=forms");
  await expect(page.getByTestId("scene-ready")).toBeVisible();
  await page.getByRole("button", { name: "切换检查器", exact: true }).click();
  await page.getByRole("button", { name: "窄面板", exact: true }).click();
  await page.getByRole("button", { name: "禁用状态", exact: true }).click();
  await expect(page.getByTestId("scene-ready")).toBeVisible();
  const frame = page.frameLocator("iframe");
  await expect(frame.getByLabel("名称", { exact: true })).toBeDisabled();
  await expect(
    frame.getByRole("button", { name: "保存", exact: true }),
  ).toBeDisabled();
  const dialog = await frame.getByRole("dialog").boundingBox();
  expect(dialog!.width).toBeLessThanOrEqual(420);
});
test("workbench language preserves the scene locale, input and fitted iframe", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto("/?scene=forms");
  await expect(page.getByTestId("scene-ready")).toBeVisible();
  const input = page.frameLocator("iframe").getByLabel("名称", { exact: true });
  await input.fill("Keep this draft across languages");
  const originalFrame = await page.locator("iframe").elementHandle();
  const originalScale = await page.locator(".frame-container").evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await selectOption(page.getByLabel("Workbench language"), "en-US");
  await expect(
    page.getByRole("button", { name: "Export report", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Scenario language")).toHaveAttribute(
    "value",
    "zh-CN",
  );
  await expect(input).toHaveValue("Keep this draft across languages");
  expect(await originalFrame!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(page.locator(".frame-container")).toHaveCSS("transform", originalScale);
  await selectOption(page.getByLabel("Workbench language"), "zh-CN");
  await expect(input).toHaveValue("Keep this draft across languages");
  expect(await originalFrame!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(page.locator(".frame-container")).toHaveCSS("transform", originalScale);
});
for (const preset of ["empty", "loading", "error", "boundary"] as const) {
  test(`file state ${preset} can be reset without stale results`, async ({
    page,
  }) => {
    await page.goto("/?scene=files");
    await expect(page.getByTestId("scene-ready")).toBeVisible();
    const names = {
      empty: "空数据",
      loading: "加载中",
      error: "异常与失败",
      boundary: "边界数据",
    };
    await page.getByRole("button", { name: "切换检查器", exact: true }).click();
    await page
      .getByRole("button", { name: names[preset], exact: true })
      .click();
    await expect(page.getByTestId("scene-ready")).toBeVisible();
    await page.getByRole("button", { name: "重置配置", exact: true }).click();
    await expect(page.getByTestId("scene-ready")).toBeVisible();
    await expect(page.frameLocator("iframe").locator("body")).toContainText(
      "README.md",
    );
    await expect(page.frameLocator("iframe").locator("body")).not.toContainText(
      "模拟故障",
    );
  });
}
test("registered plugin uses production blocks and a mutable form", async ({
  page,
}) => {
  await page.goto("/?scene=plugin-view");
  await expect(page.getByTestId("scene-ready")).toBeVisible();
  const frame = page.frameLocator("iframe");
  await expect(
    frame.getByText("已登记的插件扩展", { exact: true }),
  ).toBeVisible();
  await frame.getByLabel("场景名称").fill("Plugin acceptance");
  await frame.getByRole("button", { name: "提交", exact: true }).click();
  await expect(frame.locator("body")).toContainText("已完成合成插件操作");
});
test("workbench has actual split production file and editor panels", async ({
  page,
}) => {
  await page.goto("/?scene=workbench");
  await expect(page.getByTestId("scene-ready")).toBeVisible();
  const frame = page.frameLocator("iframe");
  await expect(frame.locator(".cm-editor")).toBeVisible();
  await expect(
    frame.getByText("README.md", { exact: true }).first(),
  ).toBeVisible();
});

test("preview zoom preserves the renderer and interactive input", async ({
  page,
}) => {
  await page.goto("/?scene=forms");
  await expect(page.getByTestId("scene-ready")).toBeVisible();
  const frame = page.frameLocator("iframe");
  await frame.getByLabel("名称", { exact: true }).fill("缩放保留草稿");
  const source = await page.locator("iframe").getAttribute("src");
  const viewport = await page.locator("iframe").evaluate((node) => ({
    width: node.clientWidth,
    height: node.clientHeight,
  }));
  const scale = page.getByLabel("预览比例", { exact: true });
  await selectOption(scale, "1");
  await expect(page.locator(".frame-container")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
  await page.getByRole("button", { name: "放大预览", exact: true }).click();
  await expect(scale).toHaveAttribute("value", "1.1");
  await page.getByRole("button", { name: "缩小预览", exact: true }).click();
  await expect(scale).toHaveAttribute("value", "1");
  await selectOption(scale, "0.5");
  await expect(frame.getByLabel("名称", { exact: true })).toHaveValue(
    "缩放保留草稿",
  );
  await frame.getByLabel("名称", { exact: true }).fill("缩放后仍可输入");
  await page.getByRole("button", { name: "适应窗口", exact: true }).click();
  await expect(scale).toHaveAttribute("value", "fit");
  await expect(frame.getByLabel("名称", { exact: true })).toHaveValue(
    "缩放后仍可输入",
  );
  await expect(page.locator("iframe")).toHaveAttribute("src", source!);
  expect(
    await page.locator("iframe").evaluate((node) => ({
      width: node.clientWidth,
      height: node.clientHeight,
    })),
  ).toEqual(viewport);
});

for (const size of [
  { width: 1280, height: 800 },
  { width: 900, height: 600 },
  { width: 600, height: 640 },
]) {
  test(`fit keeps the whole preview visible at ${size.width}×${size.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(size);
    await page.goto("/?scene=hosts");
    await expect(page.getByTestId("scene-ready")).toBeVisible();
    await expect
      .poll(() =>
        page.locator(".preview-canvas").evaluate((node) => {
          const container = node.getBoundingClientRect();
          const frame = node
            .querySelector(".frame-container")!
            .getBoundingClientRect();
          return (
            frame.left >= container.left &&
            frame.right <= container.right + 1 &&
            frame.top >= container.top &&
            frame.bottom <= container.bottom + 1 &&
            node.scrollWidth <= node.clientWidth + 1 &&
            node.scrollHeight <= node.clientHeight + 1
          );
        }),
      )
      .toBe(true);
    if (size.width === 1280) {
      await page.screenshot({
        path: testInfo.outputPath("graphite-workbench.png"),
      });
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (size.width < 1180) {
      await expect(page.locator(".inspector")).toBeHidden();
      await page
        .getByRole("button", { name: "切换检查器", exact: true })
        .click();
      await expect(page.getByLabel("视口宽度", { exact: true })).toBeVisible();
      await page
        .getByRole("button", { name: "关闭检查器", exact: true })
        .click();
      await expect(page.locator(".inspector")).toBeHidden();
    }
    await selectOption(page.getByLabel("预览比例", { exact: true }), "1");
    await expect
      .poll(() =>
        page
          .locator(".preview-canvas")
          .evaluate(
            (node) =>
              node.scrollWidth > node.clientWidth ||
              node.scrollHeight > node.clientHeight,
          ),
      )
      .toBe(true);
    await page.getByRole("button", { name: "适应窗口", exact: true }).click();
    await page
      .getByRole("button", { name: "切换资源管理器", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "下一个场景", exact: true }),
    ).toBeVisible();
  });
}
