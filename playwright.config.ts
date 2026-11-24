import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  expect: { timeout: 15000 },
  timeout: 90000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.TUNNELDE_DEBUGGER_URL ?? "http://127.0.0.1:4760",
    viewport: { width: 1600, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:4760/api/config",
    reuseExistingServer: true,
    timeout: 60000,
  },
});
