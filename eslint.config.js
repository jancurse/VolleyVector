import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import stylisticPlugin from "@stylistic/eslint-plugin";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": tsPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "@stylistic": stylisticPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // TypeScript rules
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",

      // React rules
      ...reactPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off", // Not needed in React 19
      "react/prop-types": "off", // Using TypeScript for prop validation

      // React Hooks rules
      ...reactHooksPlugin.configs.recommended.rules,

      // Stylistic rules (non-formatting code patterns)
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "*", next: "return" },
        { blankLine: "always", prev: ["const", "let", "var"], next: "*" },
        { blankLine: "any", prev: ["const", "let", "var"], next: ["const", "let", "var"] },
      ],
    },
  },
  // Disable formatting rules that conflict with Prettier
  prettierConfig,
];
