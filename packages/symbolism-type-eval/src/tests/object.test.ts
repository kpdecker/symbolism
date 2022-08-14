import { mockProgram } from "@symbolism/test";
import { findIdentifiers } from "@symbolism/ts-utils";
import { printSchema } from "../print/typescript";
import { convertTSTypeToSchema } from "../schema";
import { SchemaContext } from "../context";
import ts from "typescript";
import { createJsonSchema } from "../print/json";

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

    context: new SchemaContext(node, checker),
  };
}

describe("type schema converter", () => {
  describe("object literals", () => {
    it("should convert static property types", () => {
      const { type, context, sourceFile } = testType(`
        type Source = {
          directUnion: 1 | 2 | 3;
        };

        declare const zeeString: string;
        const zeeRealString = 'real!';

        declare const zeeObject: Record<string, number> & {
          extra: string;
          [key: \`foo\${string}\`]: string;
        };

        declare const source: Source;
        const literal = {
          "source!": source,
          source,
          string: zeeString,

          get gettor(): Source {},
          set settor(value: boolean) {},

          get bothor() {},
          set bothor(value: string) {},

          methodor(a: number): string {},

          [zeeString + 'foo' + zeeRealString]: "literal!",
          [zeeRealString + 'bar']: 42,

          ...source,
          ...zeeObject,
        }
        type Type = typeof literal;
      `);
      expect(printSchema(convertTSTypeToSchema(...context.clone(type))))
        .toMatchInlineSnapshot(`
        "{
          bothor: string;
          directUnion: 1 | 2 | 3;
          extra: string;
          gettor: { directUnion: 1 | 2 | 3 };
          methodor: (a: number) => string;
          \\"real!bar\\": 42;
          settor: false | true;
          source: { directUnion: 1 | 2 | 3 };
          \\"source!\\": { directUnion: 1 | 2 | 3 };
          string: string;
          [k: \`\${string}fooreal!\`]: \\"literal!\\";
          [k: string]: number;
          [k: \`foo\${string}\`]: string;
        };
        "
      `);

      expect(
        createJsonSchema({
          $id: "test.ts",
          schema: convertTSTypeToSchema(...context.clone(type)),
        })
      ).toMatchInlineSnapshot(`
        Object {
          "$comment": undefined,
          "$id": "test.ts",
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "patternProperties": Object {
            "/^.*$/": Object {
              "type": "number",
            },
            "/^.*fooreal!$/": Object {
              "const": "literal!",
            },
            "/^foo.*$/": Object {
              "type": "string",
            },
          },
          "properties": Object {
            "bothor": Object {
              "type": "string",
            },
            "directUnion": Object {
              "enum": Array [
                1,
                2,
                3,
              ],
              "type": "string",
            },
            "extra": Object {
              "type": "string",
            },
            "gettor": Object {
              "patternProperties": undefined,
              "properties": Object {
                "directUnion": Object {
                  "enum": Array [
                    1,
                    2,
                    3,
                  ],
                  "type": "string",
                },
              },
              "type": "object",
            },
            "methodor": Object {
              "message": "((a: number) => string) is not supported in JSON schema",
              "type": "error",
            },
            "real!bar": Object {
              "const": 42,
            },
            "settor": Object {
              "anyOf": Array [
                Object {
                  "const": true,
                },
                Object {
                  "const": false,
                },
              ],
            },
            "source": Object {
              "patternProperties": undefined,
              "properties": Object {
                "directUnion": Object {
                  "enum": Array [
                    1,
                    2,
                    3,
                  ],
                  "type": "string",
                },
              },
              "type": "object",
            },
            "source!": Object {
              "patternProperties": undefined,
              "properties": Object {
                "directUnion": Object {
                  "enum": Array [
                    1,
                    2,
                    3,
                  ],
                  "type": "string",
                },
              },
              "type": "object",
            },
            "string": Object {
              "type": "string",
            },
          },
          "type": "object",
        }
      `);

      const literalNode = findIdentifiers(sourceFile, "literal")[0];
      const assignNode = literalNode.parent as ts.VariableDeclaration;
      expect(
        printSchema(
          convertTSTypeToSchema(
            ...context.clone(undefined, assignNode.initializer!)
          )
        )
      ).toMatchInlineSnapshot(`
        "{
          bothor: string;
          directUnion: 1 | 2 | 3;
          extra: string;
          gettor: { directUnion: 1 | 2 | 3 };
          methodor: (a: number) => string;
          \\"real!bar\\": 42;
          settor: false | true;
          source: { directUnion: 1 | 2 | 3 };
          \\"source!\\": { directUnion: 1 | 2 | 3 };
          string: string;
          [k: \`\${string}fooreal!\`]: \\"literal!\\";
          [k: string]: number;
          [k: \`foo\${string}\`]: string;
        };
        "
      `);
    });
    it("should narrow computed properties in object literals", () => {
      const { type, context, sourceFile } = testType(`
        type Source = {
          directUnion: 1 | 2 | 3 | 4;
        };

        declare const source: Source;
        const literal = {
            [source.directUnion + "foo"]: 0,
            [source.directUnion + "bar"]: 0,
            blat: "yes",
        }
        type Type = typeof literal;
      `);

      // Object literal becomes an anonymous type when referenced elsewhere
      // Have to trace it to the source
      const literalNode = findIdentifiers(sourceFile, "literal")[0];
      const assignNode = literalNode.parent as ts.VariableDeclaration;
      expect(
        printSchema(
          convertTSTypeToSchema(
            ...context.clone(undefined, assignNode.initializer!)
          )
        )
      ).toMatchInlineSnapshot(`
        "{
          \\"1bar\\": 0;
          \\"1foo\\": 0;
          \\"2bar\\": 0;
          \\"2foo\\": 0;
          \\"3bar\\": 0;
          \\"3foo\\": 0;
          \\"4bar\\": 0;
          \\"4foo\\": 0;
          blat: \\"yes\\";
        };
        "
      `);

      expect(
        printSchema(
          convertTSTypeToSchema(...context.clone(undefined, literalNode!))
        )
      ).toMatchInlineSnapshot(`
        "{
          \\"1bar\\": 0;
          \\"1foo\\": 0;
          \\"2bar\\": 0;
          \\"2foo\\": 0;
          \\"3bar\\": 0;
          \\"3foo\\": 0;
          \\"4bar\\": 0;
          \\"4foo\\": 0;
          blat: \\"yes\\";
        };
        "
      `);

      expect(printSchema(convertTSTypeToSchema(type, context)))
        .toMatchInlineSnapshot(`
        "{
          \\"1bar\\": 0;
          \\"1foo\\": 0;
          \\"2bar\\": 0;
          \\"2foo\\": 0;
          \\"3bar\\": 0;
          \\"3foo\\": 0;
          \\"4bar\\": 0;
          \\"4foo\\": 0;
          blat: \\"yes\\";
        };
        "
      `);
    });
  });

  it("should handle any spreads in object literals", () => {
    const { type, context, sourceFile } = testType(`
        type Source = {
          directUnion: 1 | 2 | 3 | 4;
        };

        declare const source: any;
        const literal = {
            [source.directUnion + "foo"]: 0,
            [source.directUnion + "bar"]: 0,
            blat: "yes",
            ...source,
            undefinedSpread: {
              dis: true,
              ...undefined
            },
            nullSpread: {
              dat: true,
              ...null
            },
            objectSpread: {
              deOther: true,
              ...{}
            },
            objectSpread: {
              deOther: true,
              ...(source ? {foo: "bar"} : { baz: "qux" })
            }
        }
        type Type = typeof literal;
      `);

    // Object literal becomes an anonymous type when referenced elsewhere
    // Have to trace it to the source
    const literalNode = findIdentifiers(sourceFile, "literal")[0];
    const assignNode = literalNode.parent as ts.VariableDeclaration;
    expect(
      printSchema(
        convertTSTypeToSchema(
          ...context.clone(undefined, assignNode.initializer!)
        )
      )
    ).toMatchInlineSnapshot(`
      "{
        blat: \\"yes\\";
        nullSpread: { dat: true };
        objectSpread: {
          baz: \\"qux\\";
          deOther: true;
          foo: \\"bar\\";
        };
        undefinedSpread: { dis: true };
        [k: \`\${any}foo\`]: 0;
        [k: \`\${any}bar\`]: 0;
        [k: any]: any;
      };
      "
    `);
  });
});
