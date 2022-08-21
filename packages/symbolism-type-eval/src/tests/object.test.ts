import { mockProgram } from "@symbolism/test";
import { findIdentifiers } from "@symbolism/ts-utils";
import { printSchema } from "../print/typescript";
import { SchemaContext } from "../context";
import ts from "typescript";
import { createJsonSchema } from "../print/json";
import { getNodeSchema } from "../value-eval";
import { evaluateSchema } from "../schema";
import { getTypeSchema } from "../type-eval";

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

describe("type schema converter", () => {
  describe("object literals", () => {
    it("should convert static property types", () => {
      const { declaration, context, sourceFile } = testType(`
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
      expect(printSchema(evaluateSchema(declaration, context.checker)))
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
          schema: evaluateSchema(declaration, context.checker),
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
        printSchema(evaluateSchema(assignNode.initializer!, context.checker))
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
        printSchema(evaluateSchema(assignNode.initializer!, context.checker))
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

      expect(printSchema(evaluateSchema(literalNode!, context.checker)))
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

      expect(printSchema({ root: getTypeSchema(type, context) }))
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
      printSchema(evaluateSchema(assignNode.initializer!, context.checker))
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

  describe("object access", () => {
    it("should handle object access", () => {
      const { type, context, sourceFile } = testType(`
        type Source = {
          directUnion: 1 | 2 | 3 | 4;
        };

        declare const source: any;
        const literal = {
            [source.directUnion + "foo"]: 0,
            [source.directUnion + "bar"]: 0,
            blat: "yes",
            objectSpread: {
              deOther: true,
              ...(source ? {foo: "bar"} : { baz: "qux" })
            }
        }

        let union: {foo: "bar"} & { baz: "qux" };
        const unionLookup = union[source];
        const unionLookup2 = union["foo"];

        const primitiveLookup = literal[source];

        const spreadName = "objectSpread";
        const literalLookup = literal[spreadName]

        const anyLookup = aaannyy[spreadName];

        const objectObjectLookup = literal[literal];

        const arr: number[] = [1, 2, 3];
        const arrayLookup = arr[source];

        const stringLookup = spreadName['length'];
        const stringAbstractLookup = spreadName[source];

        type Type = typeof literal;
      `);

      function testVar(name: string) {
        const literalNode = findIdentifiers(sourceFile, name)[0];
        const assignNode = literalNode.parent as ts.VariableDeclaration;
        return printSchema(
          evaluateSchema(assignNode.initializer!, context.checker)
        )!;
      }

      expect(testVar("unionLookup")).toMatchInlineSnapshot(`
        "\\"bar\\" | \\"qux\\";
        "
      `);
      expect(testVar("unionLookup2")).toMatchInlineSnapshot(`
        "\\"bar\\";
        "
      `);

      expect(testVar("primitiveLookup")).toMatchInlineSnapshot(`
        " \\"yes\\"
          | {
              baz: \\"qux\\";
              deOther: true;
              foo: \\"bar\\";
            }
          | 0;
        "
      `);
      expect(testVar("literalLookup")).toMatchInlineSnapshot(`
        "{
          baz: \\"qux\\";
          deOther: true;
          foo: \\"bar\\";
        };
        "
      `);
      expect(testVar("anyLookup")).toMatchInlineSnapshot(`
        "any;
        "
      `);
      expect(testVar("objectObjectLookup")).toMatchInlineSnapshot(`
        "undefined;
        "
      `);

      expect(testVar("arrayLookup")).toMatchInlineSnapshot(`
        "1 | 2 | 3;
        "
      `);

      expect(testVar("stringLookup")).toMatchInlineSnapshot(`
        "12;
        "
      `);

      expect(testVar("stringAbstractLookup")).toMatchInlineSnapshot(`
        " (() => IterableIterator<string>)
          | (() => string)
          | ((form: \\"NFC\\" | \\"NFD\\" | \\"NFKC\\" | \\"NFKD\\") => string)
          | ((from: number, length: number) => string)
          | ((locales: string[] | string) => string)
          | ((matcher: {
              \\"[Symbol.match]\\": (string: string) => RegExpMatchArray;
            }) => RegExpMatchArray)
          | ((maxLength: number, fillString: string) => string)
          | ((pos: number) => number)
          | ((regexp: RegExp | string) => RegExpMatchArray)
          | ((regexp: RegExp | string) => number)
          | ((searchString: string, position: number) => false | true)
          | ((searchString: string, position: number) => number)
          | ((searchValue: RegExp | string, replaceValue: string) => string)
          | ((
              searchValue: RegExp | string,
              replacer: (substring: string, args: any[]) => string
            ) => string)
          | ((
              searchValue: {
                \\"[Symbol.replace]\\": (string: string, replaceValue: string) => string;
              },
              replaceValue: string
            ) => string)
          | ((
              searchValue: {
                \\"[Symbol.replace]\\": (
                  string: string,
                  replacer: (substring: string, args: any[]) => string
                ) => string;
              },
              replacer: (substring: string, args: any[]) => string
            ) => string)
          | ((searcher: { \\"[Symbol.search]\\": (string: string) => number }) => number)
          | ((separator: RegExp | string, limit: number) => string[])
          | ((size: number) => string)
          | ((
              splitter: {
                \\"[Symbol.split]\\": (string: string, limit: number) => string[];
              },
              limit: number
            ) => string[])
          | ((strings: string[]) => string)
          | ((that: string) => number)
          | ((
              that: string,
              locales: string[] | string,
              options: {
                caseFirst: string;
                ignorePunctuation: false | true;
                localeMatcher: string;
                numeric: false | true;
                sensitivity: string;
                usage: string;
              }
            ) => number)
          | ((url: string) => string)
          | number;
        "
      `);
    });
  });
});
