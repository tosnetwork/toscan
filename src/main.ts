import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import "./styles/main.css";

const savedTheme = localStorage.getItem("toscan-theme") ?? "system";
const dark = savedTheme === "dark" || (savedTheme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.dataset.theme = dark ? "dark" : "light";

createApp(App).use(router).mount("#app");
