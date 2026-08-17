import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "real-chain.spec.ts",
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: {
    baseURL: process.env.TOSCAN_REAL_WEB_ORIGIN ?? "http://127.0.0.1:19455",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "real-chain-chromium", use: { ...devices["Desktop Chrome"] } }],
});
