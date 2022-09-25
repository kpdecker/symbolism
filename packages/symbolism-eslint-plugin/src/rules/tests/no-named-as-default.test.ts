import { ESLintUtils } from "@typescript-eslint/utils";
import noExportAsDefault from "../no-named-as-default";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: require.resolve("../../../../../tsconfig.json"),
  },
});

ruleTester.run("no-named-as-default", noExportAsDefault, {
  valid: [
    { code: 'import React from "react";', filename: __filename },
    { code: 'import Foo from "react";', filename: __filename },
  ],

  invalid: [
    {
      code: "import createElement from 'react'",
      filename: __filename,
      errors: [{ messageId: "nameConflict", data: { name: "createElement" } }],
    },
  ],
});
