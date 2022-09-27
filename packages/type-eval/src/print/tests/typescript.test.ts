import ts from "typescript";
import {
  AnySchemaNode,
  ArraySchema,
  ObjectSchema,
  TemplateLiteralSchema,
} from "../../schema";
import { printSchema, printSchemaNode } from "../typescript";

const simpleObject: ObjectSchema = {
  kind: "object",
  properties: {
    foo: {
      kind: "primitive",
      name: "any",
      node: undefined!,
    },
  },
  abstractIndexKeys: [],
};

const templateLiteral: TemplateLiteralSchema = {
  kind: "template-literal",
  items: [
    { kind: "literal", value: "string!`" },
    {
      kind: "intersection",
      items: [
        { kind: "primitive", name: "string", node: undefined! },
        { kind: "primitive", name: "number", node: undefined! },
      ],
    },
  ],
};

const objectTest: ObjectSchema = {
  kind: "object",
  properties: {
    str: {
      kind: "primitive",
      name: "string",
      node: undefined!,
    },

    num: {
      kind: "primitive",
      name: "number",
      node: undefined!,
    },

    literal: {
      kind: "literal",
      value: "literal",
    },

    func: {
      kind: "function",
      parameters: [],
      returnType: {
        kind: "primitive",
        name: "boolean",
        node: undefined!,
      },
    },
    union: {
      kind: "union",
      items: [templateLiteral, { kind: "literal", value: "union!" }],
    },
  },

  abstractIndexKeys: [
    {
      key: {
        kind: "template-literal",
        items: [
          { kind: "literal", value: "string" },
          { kind: "primitive", name: "boolean", node: undefined! },
          simpleObject,
        ],
      },
      value: {
        kind: "tuple",
        items: [
          { kind: "primitive", name: "string", node: undefined! },
          simpleObject,
          { kind: "primitive", name: "number", node: undefined! },
        ],
        elementFlags: [],
      },
    },
    {
      key: {
        kind: "union",
        items: [
          { kind: "literal", value: "union!" },
          simpleObject,
          { kind: "literal", value: "union¡" },
        ],
      },
      value: {
        kind: "binary-expression",
        operator: ts.SyntaxKind.PlusToken,
        items: [
          { kind: "literal", value: 42 },
          {
            kind: "binary-expression",
            operator: ts.SyntaxKind.PlusToken,
            items: [
              { kind: "literal", value: 32 },
              { kind: "primitive", name: "number", node: undefined! },
            ],
          },
        ],
      },
    },
  ],
};

const arrayTest: ArraySchema = {
  kind: "array",
  items: templateLiteral,
};

describe("typescript formatter", () => {
  it("should output a valid ts file", () => {
    expect(printSchema({ root: objectTest })).toMatchInlineSnapshot(`
      "{
        func: () => boolean;
        literal: \\"literal\\";
        num: number;
        str: string;
        union: \\"union!\\" | \`string!\\\\\`\${number & string}\`;
        [k: \`string\${boolean}\${{ foo: any }}\`]: [string, { foo: any }, number];
        [k: \\"union!\\" | \\"union¡\\" | { foo: any }]: \`42 + 32 + \${number}\`;
      };
      "
    `);
    expect(printSchema({ root: arrayTest })).toMatchInlineSnapshot(`
      "\`string!\\\\\`\${number & string}\`[];
      "
    `);
  });

  it("should handle object literals in template", () => {
    // Likely invalid code, but we want to make sure that the printer doesn't crash.
    const templateLiteral: AnySchemaNode = {
      kind: "template-literal",
      items: [
        {
          kind: "literal",
          value: "start!:",
        },
        {
          kind: "object",
          properties: {
            foo: {
              kind: "literal",
              value: "food",
            },
            bar: {
              kind: "literal",
              value: "bard",
            },
          },
          abstractIndexKeys: [],
        },
      ],
    };

    expect(printSchemaNode(templateLiteral, "js")).toMatchInlineSnapshot(`
      "\`start!:\${{
        bar: \\"bard\\",
        foo: \\"food\\",
      }}\`"
    `);
  });
});
