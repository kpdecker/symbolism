import { ESLintUtils } from "@typescript-eslint/utils";

import noRestrictedSymbols from "../no-restricted-symbols";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: require.resolve("../../../../../tsconfig.json"),
  },
});

ruleTester.run("no-restricted-symbols", noRestrictedSymbols, {
  valid: [
    {
      code: 'const foo = "bar";',
      options: ["Location.search"],
      filename: __filename,
    },
    {
      code: `
        interface Location {
          search: string;
        }

        declare const foo: Location;
        foo.search;
`,
      options: [
        {
          symbolPath: "Location.search",
          fileName: "typescript/lib/lib.dom.d.ts",
        },
      ],
      filename: __filename,
    },
  ],
  invalid: [
    {
      code: "const foo = window.location.search;",
      options: ["Location.search"],
      filename: __filename,
      errors: [
        {
          messageId: "noRestrictedSymbol",
          data: {
            path: "Location.search",
            message: "",
          },
        },
      ],
    },
    {
      code: `
        const winder = window;
        const foo = winder.location.search;
`,
      options: ["Location.search"],
      filename: __filename,
      errors: [
        {
          messageId: "noRestrictedSymbol",
          data: {
            path: "Location.search",
            message: "",
          },
        },
      ],
    },
    {
      code: `
        const loc = window.location;
        const foo = loc.search;
`,
      options: ["Location.search"],
      filename: __filename,
      errors: [
        {
          messageId: "noRestrictedSymbol",
          data: {
            path: "Location.search",
            message: "",
          },
        },
      ],
    },
    {
      code: `
        interface Location {
          search: string;
        }

        declare const foo: Location;
        foo.search;
`,
      options: [{ symbolPath: "Location.search" }],
      filename: __filename,
      errors: [
        {
          messageId: "noRestrictedSymbol",
          data: {
            path: "Location.search",
            message: "",
          },
        },
      ],
    },
    {
      code: `
        interface Location {
          search: string;
        }

        declare const foo: Location;
        foo.search;
`,
      options: [{ symbolPath: "Location.search" }],
      filename: __filename,
      errors: [
        {
          messageId: "noRestrictedSymbol",
          data: {
            path: "Location.search",
            message: "",
          },
        },
      ],
    },
    {
      code: `
        interface Location {
          search: string;
        }

        declare const foo: Location;
        foo.search;
`,
      options: [
        {
          symbolPath: "Location.search",
          fileName:
            "packages/symbolism-eslint-plugin/src/rules/tests/no-restricted-symbols.test.ts",
        },
      ],
      filename: __filename,
      errors: [
        {
          messageId: "noRestrictedSymbol",
          data: {
            path: "Location.search",
            message: "",
          },
        },
      ],
    },
  ],
});
