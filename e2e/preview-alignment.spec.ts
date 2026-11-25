import { expect, test, type Page } from "@playwright/test";
import { selectOption } from "./helpers";

test("settings group navigation keeps the application aligned inside the scaled preview", async ({
  page,
}, testInfo) => {
  await page.goto("/?scene=settings-appearance");
  await expect(page.getByTestId("scene-ready")).toBeVisible();
  await page
    .getByRole("button", { name: "切换资源管理器", exact: true })
    .click();
  await page.getByRole("button", { name: "记录问题", exact: true }).click();
  const frame = page.frameLocator("iframe");
  const source = await page.locator("iframe").getAttribute("src");

  for (const scale of ["fit", "0.5", "1", "1.25"]) {
    await selectOption(page.getByLabel("预览比例", { exact: true }), scale);
    await frame.getByRole("button", { name: "外观", exact: true }).click();
    const fontLink = frame.getByRole("button", { name: "字体", exact: true });
    await fontLink.click();
    const groupId = await fontLink.getAttribute("aria-controls");
    await expect
      .poll(() =>
        frame.locator(".settings__body").evaluate((node) => node.scrollTop),
      )
      .toBeGreaterThan(0);
    await expectAligned(page);
    // Compare local coordinates: the workbench can scale and pan the whole iframe.
    const offset = await frame
      .locator(".settings__body")
      .evaluate((node, id) => {
        const group = node.ownerDocument.getElementById(id!)!;
        const scaleY =
          node.getBoundingClientRect().height /
          (node as HTMLElement).offsetHeight;
        return (
          (group.getBoundingClientRect().top -
            node.getBoundingClientRect().top) /
          scaleY
        );
      }, groupId);
    expect(offset).toBeCloseTo(12, 0);
    await frame
      .getByRole("button", { name: "文本编辑器", exact: true })
      .click();
    await expectAligned(page);
    await page.getByRole("button", { name: "关闭检查器", exact: true }).click();
    await expectAligned(page);
    await page.getByRole("button", { name: "记录问题", exact: true }).click();
  }

  await page.getByRole("button", { name: "居中画布", exact: true }).click();
  await page.getByRole("button", { name: "拖动画布", exact: true }).click();
  const surface = (await page.getByLabel("拖动画布区域").boundingBox())!;
  await page.mouse.move(surface.x + 50, surface.y + 50);
  await page.mouse.down();
  await page.mouse.move(surface.x + 85, surface.y + 75, { steps: 4 });
  await page.mouse.up();
  await page.getByRole("button", { name: "拖动画布", exact: true }).click();
  await expectAligned(page);
  await expect(page.locator("iframe")).toHaveAttribute("src", source!);
  await page.screenshot({ path: testInfo.outputPath("aligned-preview.png") });
});

async function expectAligned(page: Page) {
  const frame = page.frameLocator("iframe");
  const shell = await frame.locator(".app").evaluate((app) => ({
    scrollTop: app.scrollTop,
    scrollLeft: app.scrollLeft,
    bodyTop: app.querySelector(".app__body")!.getBoundingClientRect().top,
    statusBottom: app.querySelector(".statusbar")!.getBoundingClientRect()
      .bottom,
    height: innerHeight,
  }));
  expect(shell.scrollTop).toBe(0);
  expect(shell.scrollLeft).toBe(0);
  expect(shell.bodyTop).toBe(0);
  expect(shell.statusBottom).toBe(shell.height);
  for (const selector of [".frame-stage", ".frame-container"]) {
    expect(
      await page
        .locator(selector)
        .evaluate((node) => [node.scrollTop, node.scrollLeft]),
    ).toEqual([0, 0]);
  }
}
