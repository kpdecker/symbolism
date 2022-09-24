"use strict";

module.exports = {
  root: true,
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.json"],
  },
  plugins: ["@typescript-eslint"],
  env: {
    node: true,
  },
  ignorePatterns: [".eslintrc.*", "**/dist/**", "**/node_modules/**"],

  rules: {
    "no-inner-declarations": "off",
  },

  overrides: [
    {
      files: [
        "**/__tests__/**/*.[jt]s",
        "**/*.test.[tj]s",
        "**/__mocks__/**/*.[tj]s",
      ],
      env: {
        jest: true,
      },
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-non-null-asserted-optional-chain": "off",
        "@typescript-eslint/no-empty-function": "off",
      },
    },
  ],
};
