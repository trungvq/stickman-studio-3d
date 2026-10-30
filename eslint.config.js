import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist", "**/node_modules", "docs", "tmp", "khuyu-harness"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["apps/viewer/**/*.js", "tools/shots.mjs", "tools/bench.mjs"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ["packages/rig/src/*.ts"],
    rules: { "@typescript-eslint/no-unused-expressions": "off" },
  },
  prettier,
);
