import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";

test("export downloads a portable archive and shows its durable local path", async ({
  page,
}) => {
  await page.goto("/");
  const saved = await (await page.request.get("/api/report")).json();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出报告", exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^tunnelde-acceptance-.*\.zip$/);
  await expect(page.getByRole("status")).toContainText("报告已保存到本地");
  await expect(page.getByLabel("导出报告路径", { exact: true })).toHaveValue(
    /exports\/tunnelde-acceptance-.*\.zip$/,
  );
  const files = unzipSync(await readFile((await file.path())!));
  const report = JSON.parse(strFromU8(files["report.json"]!));
  expect(report.records).toEqual(saved.records);
  expect(files["report.md"]).toBeTruthy();
  for (const record of report.records)
    for (const image of record.screenshots)
      expect(files[`artifacts/${image}`]).toBeTruthy();
  // Retrying downloads uses the same persisted bundle, not a new mutable report.
  const retry = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载报告", exact: true }).click();
  expect((await retry).suggestedFilename()).toBe(file.suggestedFilename());
  for (const width of [460, 900]) {
    await page.setViewportSize({ width, height: 640 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "关闭导出提示" }),
    ).toBeInViewport();
  }
  await page.getByRole("button", { name: "关闭导出提示" }).click();
  await expect(page.getByLabel("报告导出结果")).toHaveCount(0);
});

test("desktop exports report success without relying on a WebView download; reveal errors stay explicit", async ({
  page,
}) => {
  await page.addInitScript(() => Object.assign(window, { isTauri: true }));
  await page.goto("/");
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.getByRole("button", { name: "导出报告", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("报告已保存到本地");
  expect(downloads).toBe(0);
  await expect(
    page.getByRole("link", { name: "下载报告", exact: true }),
  ).toHaveCount(0);
  await page.route("**/api/report/reveal", (route) =>
    route.fulfill({ status: 500, json: { error: "Cannot open folder" } }),
  );
  await page.getByRole("button", { name: "打开导出目录", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText(
    "Cannot open folder",
  );
  await expect(
    page.getByLabel("导出报告路径", { exact: true }),
  ).not.toHaveValue("");
});

test("export errors, progress and duplicate clicks are visible; records remain saved", async ({
  page,
}) => {
  await page.goto("/");
  const before = await (await page.request.get("/api/report")).json();
  let finish!: () => void;
  const held = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let requests = 0;
  await page.route("**/api/report/export", async (route) => {
    requests++;
    await held;
    await route.fulfill({ status: 500, json: { error: "Disk full" } });
  });
  await page.getByRole("button", { name: "导出报告", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "导出报告", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "导出报告", exact: true }),
  ).toContainText("正在导出");
  finish();
  await expect(page.getByRole("alert").first()).toContainText(
    "导出报告失败: Disk full",
  );
  await expect(
    page.getByRole("button", { name: "导出报告", exact: true }),
  ).toBeEnabled();
  expect(requests).toBe(1);
  expect(
    (await (await page.request.get("/api/report")).json()).records,
  ).toEqual(before.records);
});
