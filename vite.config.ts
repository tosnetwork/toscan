import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [vue()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      port: 4173,
      proxy: {
        "/jsonRPC": {
          target: env.TOS_RPC_PROXY_TARGET || "http://127.0.0.1:8011",
          changeOrigin: true,
        },
        "/tos-service-api": {
          target: env.TOS_SERVICE_PROXY_TARGET || "http://127.0.0.1:8080",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/tos-service-api/, ""),
        },
      },
    },
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.ts", "services/query/src/**/*.test.ts"],
    },
  };
});
