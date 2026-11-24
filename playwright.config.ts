import { defineConfig } from "@playwright/test";
const baseURL = process.env.TUNNELDE_DEBUGGER_URL ?? "http://127.0.0.1:4770";
const external = !!process.env.TUNNELDE_DEBUGGER_URL;
export default defineConfig({
  testDir: "./e2e",
  expect: { timeout: 15000 },
  timeout: 90000,
  fullyParallel: false,
  workers: 1,
  use: {
    browserName:
      process.env.TUNNELDE_TEST_BROWSER === "webkit" ? "webkit" : "chromium",
    baseURL,
    viewport: { width: 1600, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm dev --port 4770 --data .tunnelde-debugger/e2e",
    url: `${baseURL}/api/config`,
    reuseExistingServer: external,
    timeout: 60000,
  },
});
