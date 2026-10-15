import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "pq-native-rpc.spec.ts",
  outputDir: ".local/pq-rpc-browser-artifacts",
  workers: 1,
  retries: 0,
  use: { baseURL: "http://127.0.0.1:4182", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "pq-rpc-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "pq-rpc-mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "pnpm dev --host 127.0.0.1 --port 4182 --strictPort",
    url: "http://127.0.0.1:4182/",
    reuseExistingServer: false,
    env: { ...process.env, VITE_TOS_NETWORK: "localnet", VITE_FORCE_PREVIEW: "false", VITE_ENABLE_PREVIEW: "false", TOS_RPC_PROXY_TARGET: process.env.TOS_RPC_UPSTREAM ?? "http://127.0.0.1:52747" },
  },
});
