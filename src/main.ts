import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import { initializeTheme } from "./composables/useTheme";
import { installClientObservability } from "./observability/client";
import "./styles/main.css";

initializeTheme();
installClientObservability();

const app = createApp(App);
app.config.errorHandler = (error, _instance, info) => {
  console.error("TOSCAN render error", info, error);
  window.dispatchEvent(new ErrorEvent("error", {
    error,
    message: error instanceof Error ? error.message : String(error),
  }));
};
app.use(router).mount("#app");
