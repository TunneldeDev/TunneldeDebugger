import { selectOption } from "./helpers";
import { test, expect } from "./capture-fixture";
import { DEFAULT_PARAMETERS } from "../shared/protocol";
const saved = new Map<string, string>();
const responses: Promise<void>[] = [];
test.beforeEach(async ({ page }) => {
  saved.clear();
  responses.length = 0;
  page.on("response", (response) => {
    if (
      new URL(response.url()).pathname === "/api/acceptance" &&
      response.request().method() === "POST" &&
      response.ok()
    ) {
      responses.push(
        response.json().then((record) => {
          saved.set(record.id, record.updatedAt);
        }),
      );
    }
  });
});
test.afterEach(async ({ request }) => {
  await Promise.all(responses);
  const state = await (await request.get("/api/state")).json();
  for (const record of state.records) {
    if (saved.has(record.id)) {
      const response = await request.post(
        `/api/acceptance/${record.id}/delete`,
        { data: { expectedUpdatedAt: record.updatedAt } },
      );
      expect(response.ok()).toBe(true);
    }
  }
});
const open = async (page: import("@playwright/test").Page) => {
  await page.goto("/?scene=forms");
  await expect(page.getByTestId("scene-ready")).toBeVisible();
  await page.getByRole("button", { name: "记录问题", exact: true }).click();
};

test("live capture, annotations, durable save, editing and reversible deletion", async ({
  page,
}, testInfo) => {
  await open(page);
  const marker = `Playwright issue ${Date.now()}`;
  await page.getByLabel("问题标题", { exact: true }).fill(marker);
  await page
    .getByLabel("验收备注")
    .fill("Playwright issue: input and Escape state");
  await page.getByText("复现步骤与预期结果", { exact: true }).click();
  await page
    .getByLabel("复现步骤", { exact: true })
    .fill("1. Open form\n2. Type a name\n3. Close with Escape");
  await page.getByLabel("预期结果", { exact: true }).fill("Draft remains");
  await page
    .frameLocator("iframe")
    .getByLabel("名称", { exact: true })
    .fill("Live draft evidence");
  const frameSrc = await page.locator("iframe").getAttribute("src");
  await page.getByRole("button", { name: "截取当前界面", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("截图已加入草稿", {
    timeout: 30000,
  });
  await expect(page.locator(".attachment img")).toBeVisible();
  await expect(page.locator("iframe")).toHaveAttribute("src", frameSrc!);
  await expect(
    page.frameLocator("iframe").getByLabel("名称", { exact: true }),
  ).toHaveValue("Live draft evidence");
  const original = await page.locator(".attachment img").getAttribute("src");
  const image = await page.request.get(original!);
  expect(image.ok()).toBe(true);
  const bytes = await image.body();
  const frameBox = (await page.locator("iframe").boundingBox())!;
  expect(Math.abs(bytes.readUInt32BE(16) - frameBox.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(bytes.readUInt32BE(20) - frameBox.height)).toBeLessThanOrEqual(2);
  await testInfo.attach("live-capture", {
    body: bytes,
    contentType: "image/png",
  });
  await page.getByRole("button", { name: "预览截图 1", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "图片预览", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "原始尺寸", exact: true }).click();
  await page.getByRole("button", { name: "放大图片", exact: true }).click();
  await page.getByRole("button", { name: "关闭预览", exact: true }).click();
  await page.getByRole("button", { name: "标注", exact: true }).click();
  const canvas = page.getByLabel("截图标注画布");
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, {
    steps: 5,
  });
  await page.mouse.up();
  await page.getByRole("button", { name: "保存标注", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "标注截图" })).toHaveCount(0);
  await expect(page.locator(".attachment img")).not.toHaveAttribute(
    "src",
    original!,
  );
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("记录已保存");
  const record = page.locator(".acceptance-entry").filter({ hasText: marker });
  await expect(record).toHaveCount(1);
  await expect(record.getByRole("img")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "记录问题", exact: true }).click();
  await expect(record).toBeVisible();
  await record.getByRole("button", { name: "编辑", exact: true }).click();
  await expect(page.getByLabel("验收备注")).toHaveValue(
    "Playwright issue: input and Escape state",
  );
  await page.getByLabel("验收备注").fill("Playwright corrected issue");
  await selectOption(page.getByLabel("验收结论"), "blocked");
  await selectOption(page.getByLabel("问题优先级"), "P1");
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await expect(record).toHaveCount(1);
  await expect(record).toContainText("Playwright corrected issue");
  await expect(record).toContainText("阻塞");
  await expect(record).toContainText("P1");
  await record.getByRole("button", { name: "删除", exact: true }).click();
  await expect(record).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "记录问题", exact: true }).click();
  await page.getByRole("button", { name: "回收站", exact: true }).click();
  await record.getByRole("button", { name: "恢复记录", exact: true }).click();
  await page.getByRole("button", { name: "返回记录", exact: true }).click();
  await expect(record).toHaveCount(1);
  await record.getByRole("button", { name: "删除", exact: true }).click();
  await expect(record).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "记录问题", exact: true }).click();
  await expect(record).toHaveCount(0);
});

test("drafts and uploads survive scene navigation and reload; save errors retain all fields", async ({
  page,
}) => {
  await open(page);
  await page
    .getByLabel("问题标题", { exact: true })
    .fill("Playwright persisted draft");
  await page.getByLabel("验收备注").fill("Do not lose this issue");
  const image = await page.locator(".frame-container").screenshot();
  await page.getByLabel("上传验收图片").setInputFiles({
    name: "evidence.png",
    mimeType: "image/png",
    buffer: image,
  });
  await expect(page.locator(".attachment img")).toHaveCount(1);
  await page.getByRole("button", { name: "下一个场景", exact: true }).click();
  await expect(page.getByLabel("问题标题", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "上一个", exact: true }).click();
  await expect(page.getByLabel("问题标题", { exact: true })).toHaveValue(
    "Playwright persisted draft",
  );
  await expect(page.locator(".attachment img")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "记录问题", exact: true }).click();
  await expect(page.getByLabel("验收备注")).toHaveValue(
    "Do not lose this issue",
  );
  await expect(page.locator(".attachment img")).toHaveCount(1);
  await page.route("**/api/acceptance", (route) =>
    route.fulfill({ status: 503, json: { error: "Simulated disk failure" } }),
  );
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Simulated disk failure");
  await expect(page.getByLabel("验收备注")).toHaveValue(
    "Do not lose this issue",
  );
  await expect(page.locator(".attachment img")).toHaveCount(1);
  await page.unroute("**/api/acceptance");
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("记录已保存");
});

test("failed native scene can be reported without a running target; English actions work", async ({
  page,
}) => {
  const marker = `Playwright native startup issue ${Date.now()}`;
  await page.goto("/?scene=hosts");
  await expect(page.getByTestId("scene-ready")).toBeVisible();
  await page.getByRole("button", { name: "原生", exact: true }).click();
  await page.getByRole("button", { name: "记录问题", exact: true }).click();
  await page.getByLabel("问题标题", { exact: true }).fill(marker);
  await page.getByLabel("验收备注").fill("Native target could not start");
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("记录已保存");
  await expect(
    page.locator(".acceptance-entry").filter({ hasText: marker }),
  ).toContainText("界面模拟");
  await selectOption(page.getByLabel("Workbench language"), "en-US");
  await expect(
    page.getByRole("button", { name: "Save record", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Attach images", exact: true }),
  ).toBeVisible();
});

test("acceptance API rejects stale edits and malformed or mismatched attachments", async ({
  request,
}) => {
  const created = await request.post("/api/acceptance", {
    data: {
      scenarioId: "hosts",
      target: "browser",
      parameters: DEFAULT_PARAMETERS,
      status: "failed",
      note: "Playwright API record",
      screenshots: [],
    },
  });
  expect(created.ok()).toBe(true);
  const record = await created.json();
  const edited = await request.post("/api/acceptance", {
    data: {
      id: record.id,
      expectedUpdatedAt: record.updatedAt,
      status: "blocked",
      note: "Corrected",
      screenshots: [],
    },
  });
  expect(edited.ok()).toBe(true);
  const stale = await request.post("/api/acceptance", {
    data: {
      id: record.id,
      expectedUpdatedAt: record.updatedAt,
      status: "failed",
      note: "Stale edit",
      screenshots: [],
    },
  });
  expect(stale.status()).toBe(400);
  const invalid = await request.post("/api/attachments", {
    data: {
      scenarioId: "hosts",
      target: "browser",
      parameters: DEFAULT_PARAMETERS,
      image: "data:image/png;base64,SGVsbG8=",
    },
  });
  expect(invalid.status()).toBe(400);
  const passed = await request.post("/api/acceptance", {
    data: {
      scenarioId: "hosts",
      target: "native-mock",
      parameters: DEFAULT_PARAMETERS,
      status: "passed",
      screenshots: [],
    },
  });
  expect(passed.status()).toBe(400);
  const latest = await edited.json();
  await request.post(`/api/acceptance/${record.id}/delete`, {
    data: { expectedUpdatedAt: latest.updatedAt },
  });
});

test("paste and drop attach images; capture failure retains the draft", async ({
  page,
}) => {
  await open(page);
  await page.getByLabel("验收备注").fill("Keep issue on failed capture");
  const screenshot = await page.locator(".frame-container").screenshot();
  const base64 = screenshot.toString("base64");
  await page.locator(".acceptance-panel").evaluate((element, encoded) => {
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], "pasted.png", { type: "image/png" }));
    element.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true }),
    );
  }, base64);
  await expect(page.locator(".attachment img")).toHaveCount(1);
  await page.locator(".attachment-list").evaluate((element, encoded) => {
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], "dropped.png", { type: "image/png" }));
    element.dispatchEvent(
      new DragEvent("drop", { dataTransfer: transfer, bubbles: true }),
    );
  }, base64);
  await expect(page.locator(".attachment img")).toHaveCount(2);
  await page.route("**/api/attachments", (route) =>
    route.fulfill({ status: 500, json: { error: "Capture write failed" } }),
  );
  await page.getByRole("button", { name: "截取当前界面", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Capture write failed", {
    timeout: 30000,
  });
  await expect(page.getByLabel("验收备注")).toHaveValue(
    "Keep issue on failed capture",
  );
  await expect(page.locator(".attachment img")).toHaveCount(2);
  await page.reload();
  await page.getByRole("button", { name: "记录问题", exact: true }).click();
  await expect(page.getByLabel("验收备注")).toHaveValue(
    "Keep issue on failed capture",
  );
  await expect(page.locator(".attachment img")).toHaveCount(2);
});

test("editing history retains a separate unfinished new issue", async ({
  page,
}) => {
  await open(page);
  const marker = `Playwright edit draft ${Date.now()}`;
  await page.getByLabel("问题标题", { exact: true }).fill(marker);
  await page.getByLabel("验收备注").fill("Original issue");
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("记录已保存");
  await page.getByLabel("验收备注").fill("Unfinished new issue");
  const record = page.locator(".acceptance-entry").filter({ hasText: marker });
  await record.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByLabel("验收备注").fill("Corrected historic issue");
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("修改已保存");
  await expect(page.getByLabel("验收备注")).toHaveValue("Unfinished new issue");
  await expect(record).toContainText("Corrected historic issue");
  await page.reload();
  await page.getByRole("button", { name: "记录问题", exact: true }).click();
  await expect(page.getByLabel("验收备注")).toHaveValue("Unfinished new issue");
  await record.getByRole("button", { name: "删除", exact: true }).click();
  await expect(record).toHaveCount(0);
});
