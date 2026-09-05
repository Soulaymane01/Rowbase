import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.*"],
        },
      },
    },
  },
  {
    ignores: ["main.js", "node_modules/"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // TypeScript resolves React's namespace in type positions; the core rule
      // cannot distinguish those from runtime references.
      "no-undef": "off",
    },
  },
]);
