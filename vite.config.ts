import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const publicOrigin = (env.VITE_PUBLIC_ORIGIN || "http://localhost:4173").replace(/\/$/, "");
  const publicRoutes = ["/", "/blocks", "/transactions", "/assets", "/assets/activity", "/contracts/verified", "/agents", "/tasks", "/services", "/disputes", "/economy", "/validators", "/staking", "/governance", "/analytics", "/network", "/api-docs"];
  return {
    plugins: [vue(), {
      name: "toscan-public-sitemap",
      transformIndexHtml(html) {
        return html.replaceAll("http://localhost:4173", publicOrigin);
      },
      generateBundle() {
        const urls = publicRoutes.map((path) => `  <url><loc>${publicOrigin}${path}</loc></url>`).join("\n");
        this.emitFile({ type: "asset", fileName: "sitemap.xml", source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n` });
      },
    }],
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
      environmentOptions: { jsdom: { url: "http://localhost/" } },
      include: ["src/**/*.test.ts", "services/query/src/**/*.test.ts"],
    },
  };
});
