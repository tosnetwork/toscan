import { ref } from "vue";

export type Theme = "light" | "dark" | "system";
const theme = ref<Theme>((localStorage.getItem("toscan-theme") as Theme | null) ?? "system");
const colorScheme = matchMedia("(prefers-color-scheme: dark)");

function applyTheme(value: Theme) {
  const dark = value === "dark" || (value === "system" && colorScheme.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#111315" : "#eceef0");
}

export function initializeTheme() {
  applyTheme(theme.value);
  colorScheme.addEventListener("change", () => {
    if (theme.value === "system") applyTheme("system");
  });
}

export function useTheme() {
  function setTheme(value: Theme) {
    theme.value = value;
    localStorage.setItem("toscan-theme", value);
    applyTheme(value);
  }
  function cycleTheme() {
    const values: Theme[] = ["system", "light", "dark"];
    const current = values.indexOf(theme.value);
    setTheme(values[(current + 1) % values.length] ?? "system");
  }
  return { theme, setTheme, cycleTheme };
}
