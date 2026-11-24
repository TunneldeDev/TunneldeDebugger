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
  await page.getByRole("button", { name: "空数据", exact: true }).click();
  await expect(page.getByTestId("scene-ready")).toBeVisible();
  await page.getByRole("button", { name: "下一个场景" }).click();
  await expect(page).toHaveURL(/scene=host-details/);
  await expect(page.getByTestId("scene-ready")).toBeVisible();
  await page.getByRole("button", { name: "验收", exact: true }).click();
  await page.getByLabel("验收备注").fill("Playwright acceptance record");
  await page.getByRole("button", { name: "通过", exact: true }).click();
  await expect(page.locator(".acceptance-entry").first()).toContainText(
    "Playwright acceptance record",
  );
  await page.reload();
  await page.getByRole("button", { name: "验收", exact: true }).click();
  await expect(page.locator(".acceptance-entry").first()).toContainText(
    "Playwright acceptance record",
  );
});
test("narrow disabled forms preserve focus and contain their layout", async ({
  page,
}) => {
  await page.goto("/?scene=forms");
  await expect(page.getByTestId("scene-ready")).toBeVisible();
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
test("workbench language does not change the independent scene locale", async ({
  page,
}) => {
  await page.goto("/?scene=forms");
  await expect(page.getByTestId("scene-ready")).toBeVisible();
  await page.getByLabel("Workbench language").selectOption("en-US");
  await expect(
    page.getByRole("button", { name: "Export report", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Scenario language")).toHaveValue("zh-CN");
  await expect(
    page.frameLocator("iframe").getByLabel("名称", { exact: true }),
  ).toBeVisible();
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
