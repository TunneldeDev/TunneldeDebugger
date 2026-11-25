import { test, expect } from "@playwright/test";
import { selectOption } from "./helpers";
test("inspector stays docked without covering the movable iframe; close and controls remain usable", async ({
  page,
}, testInfo) => {
  await page.goto("/?scene=forms");
  await expect(page.getByTestId("scene-ready")).toBeVisible();
  const iframe = page.locator("iframe");
  const source = await iframe.getAttribute("src");
  await page
    .frameLocator("iframe")
    .getByLabel("名称", { exact: true })
    .fill("Move without resetting");
  const canvas = page.locator(".preview-canvas");
  const before = (await canvas.boundingBox())!;
  await page.getByRole("button", { name: "记录问题", exact: true }).click();
  const inspector = page.locator("#inspector");
  const dock = (await inspector.boundingBox())!;
  const preview = (await canvas.boundingBox())!;
  expect(preview.width).toBeLessThan(before.width);
  expect(preview.x + preview.width).toBeLessThanOrEqual(dock.x + 1);
  await expect(inspector).toHaveCSS("position", "static");
  await expect(inspector).toHaveCSS("resize", "none");
  await expect(page.getByLabel("拖动检查器", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "关闭检查器", exact: true }).click();
  await expect(inspector).toBeHidden();
  const titlebar = (await page.locator(".frame-chrome").boundingBox())!;
  await page.mouse.move(titlebar.x + 60, titlebar.y + 12);
  await page.mouse.down();
  await page.mouse.move(titlebar.x - 50, titlebar.y + 65, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator(".frame-stage")).not.toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
  await expect(iframe).toHaveAttribute("src", source!);
  await expect(
    page.frameLocator("iframe").getByLabel("名称", { exact: true }),
  ).toHaveValue("Move without resetting");
  await page.getByRole("button", { name: "居中画布", exact: true }).click();
  await expect(page.locator(".frame-stage")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
  await page.getByRole("button", { name: "拖动画布", exact: true }).click();
  const surface = (await page.getByLabel("拖动画布区域").boundingBox())!;
  await page.mouse.move(surface.x + 60, surface.y + 60);
  await page.mouse.down();
  await page.mouse.move(surface.x + 120, surface.y + 110, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator(".frame-stage")).not.toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
  await page.getByRole("button", { name: "拖动画布", exact: true }).click();
  await page.getByRole("button", { name: "居中画布", exact: true }).click();
  for (const width of [1600, 1280, 900, 600, 460]) {
    await page.setViewportSize({ width, height: 800 });
    const controls = page.locator(".preview-toolbar [role=combobox]");
    for (const control of await controls.all()) {
      const box = (await control.boundingBox())!;
      expect(box.height).toBeLessThanOrEqual(34);
      expect(box.width).toBeGreaterThan(65);
      const label = (await control.locator("span").boundingBox())!,
        arrow = (await control.locator("svg").boundingBox())!;
      expect(
        Math.abs(label.y + label.height / 2 - (arrow.y + arrow.height / 2)),
      ).toBeLessThan(3);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`toolbar-${width}.png`),
    });
    await page.getByRole("button", { name: "记录问题", exact: true }).click();
    const close = page.getByRole("button", { name: "关闭检查器", exact: true });
    const closeBox = (await close.boundingBox())!;
    expect(closeBox.x + closeBox.width).toBeLessThanOrEqual(width);
    const panelBox = (await inspector.boundingBox())!;
    const previewBox = (await canvas.boundingBox())!;
    expect(closeBox.y).toBeGreaterThanOrEqual(0);
    expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(800);
    expect(
      previewBox.x + previewBox.width <= panelBox.x + 1 ||
      previewBox.y + previewBox.height <= panelBox.y + 1,
    ).toBe(true);
    await expect(inspector).toHaveCSS("position", "static");
    await expect(
      page.frameLocator("iframe").getByLabel("名称", { exact: true }),
    ).toHaveValue("Move without resetting");
    await page.screenshot({ path: testInfo.outputPath(`docked-${width}.png`) });
    await close.click();
  }
  await page.getByLabel("数据预设", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(page.getByLabel("数据预设", { exact: true })).toBeFocused();
});
test("project configuration is visible, validates paths, applies launch settings and reports deferred port changes", async ({
  page,
  request,
}) => {
  const originalInfo = await (await request.get("/api/settings")).json();
  const original = originalInfo.settings;
  try {
    await page.goto("/?scene=hosts");
    await page.getByRole("button", { name: "项目配置", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "项目配置", exact: true });
    await expect(dialog).toBeVisible();
    await expect(
      page.getByLabel("本地 Tunnelde 项目路径", { exact: true }),
    ).toHaveValue(original.targetPath);
    await page
      .getByLabel("本地 Tunnelde 项目路径", { exact: true })
      .fill("/does/not/exist");
    await page.getByRole("button", { name: "检查项目", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await page
      .getByLabel("本地 Tunnelde 项目路径", { exact: true })
      .fill(original.targetPath);
    await page.getByRole("button", { name: "检查项目", exact: true }).click();
    await expect(dialog.getByRole("status")).toHaveText("项目与场景适配器可用");
    await page
      .getByLabel("Cargo 启动参数", { exact: true })
      .fill('["--locked"]');
    await page
      .getByLabel("启动环境变量", { exact: true })
      .fill('{"RUST_LOG":"info"}');
    await page
      .getByLabel("服务端口", { exact: true })
      .fill(String(original.servicePort + 8));
    await page.getByRole("button", { name: "保存并应用", exact: true }).click();
    await expect(dialog.getByRole("status")).toContainText("重启");
    const saved = await (await request.get("/api/settings")).json();
    expect(saved.settings.launch.cargoArgs).toEqual(["--locked"]);
    expect(saved.settings.launch.env.RUST_LOG).toBe("info");
    expect(saved.active.servicePort).toBe(originalInfo.active.servicePort);
    await page
      .getByRole("button", { name: "关闭项目配置", exact: true })
      .click();
    await page.reload();
    await page.getByRole("button", { name: "项目配置", exact: true }).click();
    await expect(
      page.getByLabel("Cargo 启动参数", { exact: true }),
    ).toHaveValue('["--locked"]');
  } finally {
    const response = await request.post("/api/settings/save", {
      data: original,
    });
    expect(response.ok()).toBe(true);
  }
});
test("native logs render ANSI colors as text nodes without exposing escape codes", async ({
  page,
  request,
}) => {
  const state = await (await request.get("/api/state")).json();
  await page.route("**/api/state", (route) =>
    route.fulfill({
      json: {
        ...state,
        nativeLogs: [
          "\x1b[1m\x1b[33mwarning\x1b[0m: example",
          "\x1b[92mFinished\x1b[0m dev profile",
        ],
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "原生", exact: true }).click();
  const log = page.locator(".native-console");
  await expect(log).toContainText("warning: example");
  await expect(log).not.toContainText("\x1b");
  await expect(log.locator("span").filter({ hasText: /^warning$/ })).toHaveCSS(
    "font-weight",
    "700",
  );
  await expect(log.locator("span").filter({ hasText: /^Finished$/ })).toHaveCSS(
    "color",
    "rgb(163, 217, 165)",
  );
});
