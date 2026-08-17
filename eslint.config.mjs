import eslint from "@eslint/js";
import vue from "eslint-plugin-vue";
import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import globals from "globals";

export default defineConfigWithVueTs(
  { ignores: ["dist/**", "services/query/dist/**", "node_modules/**"] },
  eslint.configs.recommended,
  ...vue.configs["flat/recommended"],
  vueTsConfigs.recommended,
  {
    files: ["services/query/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      "vue/multi-word-component-names": "off",
      "vue/max-attributes-per-line": "off",
      "vue/html-self-closing": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/multiline-html-element-content-newline": "off",
    },
  },
);
