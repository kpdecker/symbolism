import ts from "typescript";
import {
  AnySchemaNode,
  ArraySchema,
  ObjectSchema,
  TemplateLiteralSchema,
} from "../../schema";
import { printSchema } from "../typescript";

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
    expect(printSchema(objectTest)).toMatchInlineSnapshot(`
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
    expect(printSchema(arrayTest)).toMatchInlineSnapshot(`
      "\`string!\\\\\`\${number & string}\`[];
      "
    `);
  });
});
