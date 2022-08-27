import { mockProgram } from "@symbolism/test";
import { findIdentifiers, invariantNode } from "@symbolism/ts-utils";
import { printSchema } from "../print/typescript";
import { SchemaContext } from "../context";
import { evaluateSchema } from "../schema";
import ts from "typescript";

function testType(source: string, name = "Type") {
  const program = mockProgram({
    "test.ts": source,
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile("test.ts")!;
  const node = findIdentifiers(sourceFile, name)[0];
  return {
    type: checker.getTypeAtLocation(node),
    declaration: node,
    program,
    sourceFile,
    checker,

    context: new SchemaContext(node, checker, {}),
  };
}

function testTypeNode(typeSource: string) {
  const { type, declaration, context } = testType(`
        type Type = ${typeSource};
      `);

  const parent = declaration.parent;
  invariantNode(parent, context.checker, ts.isTypeAliasDeclaration);

  return printSchema(evaluateSchema(parent.type, context.checker));
}

// TODO: Use type references when a type is named
describe("type schema converter", () => {
  describe("primitive", () => {
    it("should convert direct types to a schema", () => {
      const { type, declaration, context } = testType(`
      enum Enum {
        a = "a",
        b = "b",
      }

      const symbolInstance = Symbol("foo");

      type bar = 'foo';
      type Type = {
        foo: string;
        bar: bar;
        bat: "foo" | "bar";
        baz: 1 | 2 | 3;
        numba: 1 | string;
        bigInt: 1n | 2n | 3n;
        bigint: bigint;
        any: any;
        unknown: unknown;
        string: string;
        number: number;
        boolean: boolean;
        enum: Enum;
        null: null;
        undefined: undefined;
        void: void;

        true: true;
        false: false;

        symbolInstance: typeof symbolInstance;
        symbol: symbol;

        array: string[];
        tuple: [string, number];
        templateType: \`foo \${string}\`;

        nonPrimitive: object;
      };
    `);

      expect(printSchema(evaluateSchema(declaration, context.checker)))
        .toMatchInlineSnapshot(`
              "{
                any: any;
                array: string[];
                bar: \\"foo\\";
                bat: \\"bar\\" | \\"foo\\";
                baz: 1 | 2 | 3;
                bigInt: 1n | 2n | 3n;
                bigint: bigint;
                boolean: false | true;
                enum: \\"a\\" | \\"b\\";
                false: false;
                foo: string;
                nonPrimitive: object;
                null: null;
                numba: 1 | string;
                number: number;
                string: string;
                symbol: symbol;
                symbolInstance: symbol;
                templateType: \`foo \${string}\`;
                true: true;
                tuple: [string, number];
                undefined: undefined;
                unknown: unknown;
                void: undefined;
              };
              "
          `);
    });

    it("should handle primitive tokens", () => {
      expect(testTypeNode("number")).toMatchInlineSnapshot(`
        "number;
        "
      `);
      expect(testTypeNode("never")).toMatchInlineSnapshot(`
        "never;
        "
      `);
    });

    it("should handle index access type", () => {
      const { type, declaration, context } = testType(`
        type Pairs<T> = {
          [TKey in keyof T]: {
            key: TKey;
            value: T[TKey];
          };
        };

        type Type<T> = Pairs<T>[keyof T];
      `);

      expect(printSchema(evaluateSchema(declaration, context.checker)))
        .toMatchInlineSnapshot(`
        "{}[keyof {}];
        "
      `);
    });
  });
});
