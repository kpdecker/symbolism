import { mockProgram } from "@noom/symbolism-test";
import { findIdentifiers } from "@noom/symbolism-ts-utils";
import { printSchema } from "../print/typescript";
import { SchemaContext } from "../context";
import ts from "typescript";
import { createJsonSchema } from "../print/json";
import { evaluateSchema } from "../schema";
import { getTypeSchema } from "../type-eval";

function testType(source: string, options?: ts.CompilerOptions) {
  const program = mockProgram(
    {
      "test.ts": source,
    },
    options
  );
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile("test.ts")!;
  const node = findIdentifiers(sourceFile, "Type")[0];
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
        "type Source = { directUnion: 1 | 2 | 3 };

        {
          bothor: string;
          directUnion: 1 | 2 | 3;
          extra: string;
          gettor: Source;
          methodor: (a: number) => string;
          \\"real!bar\\": 42;
          settor: false | true;
          source: Source;
          \\"source!\\": Source;
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
          "$defs": Object {
            "Source": Object {
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
          },
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
              "$ref": "#/$defs/Source",
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
              "$ref": "#/$defs/Source",
            },
            "source!": Object {
              "$ref": "#/$defs/Source",
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
        "type Source = { directUnion: 1 | 2 | 3 };

        {
          bothor: string;
          directUnion: 1 | 2 | 3;
          extra: string;
          gettor: Source;
          methodor: (a: number) => string;
          \\"real!bar\\": 42;
          settor: false | true;
          source: Source;
          \\"source!\\": Source;
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

      expect(
        printSchema({
          root: getTypeSchema({ type, context, decrementDepth: false }),
        })
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
    });
  });

  it("should handle any spreads in object literals", () => {
    const { context, sourceFile } = testType(`
        type Source = {
          directUnion: 1 | 2 | 3 | 4;
        };

        declare const source: any;
        declare const obj: { foo: string; bar: string };

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
            },

            ...(obj || { bat: true }),
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
        bar: string;
        bat: true;
        blat: \\"yes\\";
        foo: string;
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
  it("should handle any spreads in strict null object literals", () => {
    const { context, sourceFile } = testType(
      `
        declare const obj: { foo: string; bar: string } | undefined;

        const literal = {
            ...(obj || { bat: true }),
        }
        type Type = typeof literal;
      `,
      {
        strictNullChecks: true,
      }
    );

    // Object literal becomes an anonymous type when referenced elsewhere
    // Have to trace it to the source
    const literalNode = findIdentifiers(sourceFile, "literal")[0];
    const assignNode = literalNode.parent as ts.VariableDeclaration;
    expect(
      printSchema(evaluateSchema(assignNode.initializer!, context.checker))
    ).toMatchInlineSnapshot(`
      "{
        bar: string;
        bat: true;
        foo: string;
      };
      "
    `);
  });

  describe("object access", () => {
    it("should handle object access", () => {
      const { context, sourceFile } = testType(`
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

        const tuple = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

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

        const tupleLookup = tuple[0];
        const tupleAbstractLookup = tuple[source];

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
        "type IterableIterator<string> = {
          \\"[Symbol.iterator]\\": () => IterableIterator<string>;
          next: (
            args: [{}] | []
          ) => IteratorReturnResult<any> | IteratorYieldResult<string>;
          return: (value: {}) => IteratorResult<string, any>;
          throw: (e: any) => IteratorResult<string, any>;
        };

        type IteratorResult<string, any> = IteratorReturnResult<any> | IteratorYieldResult<string>;

        type IteratorReturnResult<any> = {
          done: true;
          value: any;
        };

        type IteratorYieldResult<string> = {
          done: false;
          value: string;
        };

         (() => IterableIterator<string>)
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

      expect(testVar("tupleLookup")).toMatchInlineSnapshot(`
        "1;
        "
      `);
      expect(testVar("tupleAbstractLookup")).toMatchInlineSnapshot(`
        "1 | 10 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
        "
      `);
    });
    it("should handle element lookup on primitive unions and intersections", () => {
      const { context, sourceFile } = testType(`
        declare const source: string;

        let union: string & number;
        const unionLookup = union[source];
        const unionLookup2 = union["foo"];

        let intersection: string & number;
        const intersectionLookup = intersection[source];
        const intersectionLookup2 = intersection["foo"];

        enum Enum {
          foo,
          bar
        }
        const enumLookup = Enum[source];
        const enumLookup2 = Enum["foo"];
      `);

      function testVar(name: string) {
        const literalNode = findIdentifiers(sourceFile, name)[0];
        const assignNode = literalNode.parent as ts.VariableDeclaration;
        return printSchema(
          evaluateSchema(assignNode.initializer!, context.checker)
        )!;
      }

      expect(testVar("unionLookup")).toMatchInlineSnapshot(`
        "never;
        "
      `);
      expect(testVar("unionLookup2")).toMatchInlineSnapshot(`
        "never;
        "
      `);

      expect(testVar("intersectionLookup")).toMatchInlineSnapshot(`
        "never;
        "
      `);
      expect(testVar("intersectionLookup2")).toMatchInlineSnapshot(`
        "never;
        "
      `);

      expect(testVar("enumLookup")).toMatchInlineSnapshot(`
        "never;
        "
      `);
      expect(testVar("enumLookup2")).toMatchInlineSnapshot(`
        "never;
        "
      `);
    });
  });

  it("should handle any spreads in object literals", () => {
    const { context, sourceFile } = testType(`
        declare const source: any;
        const literal = {
            blat: "yes",
            foo: "bar",
        }

        const { foo, baz, ...rest } = literal;
      `);

    const fooNode = findIdentifiers(sourceFile, "foo")[1];
    expect(printSchema(evaluateSchema(fooNode, context.checker)))
      .toMatchInlineSnapshot(`
      "\\"bar\\";
      "
    `);

    const bazNode = findIdentifiers(sourceFile, "baz")[0];
    expect(printSchema(evaluateSchema(bazNode, context.checker)))
      .toMatchInlineSnapshot(`
      "never;
      "
    `);

    const restNode = findIdentifiers(sourceFile, "rest")[0];
    expect(printSchema(evaluateSchema(restNode, context.checker)))
      .toMatchInlineSnapshot(`
      "{ blat: string };
      "
    `);
  });

  describe("index signatures", () => {
    it("should evaluate index keys", () => {
      const { checker, sourceFile } = testType(`
        declare const injectedConfig: Record<string, string>;

        export const appConfig = {
          food: injectedConfig.food,
        } as const;

        const food = appConfig.food;
      `);

      const appConfigNodes = findIdentifiers(sourceFile, "appConfig");
      expect(printSchema(evaluateSchema(appConfigNodes[0], checker)))
        .toMatchInlineSnapshot(`
        "{ food: string };
        "
      `);

      const foodNodes = findIdentifiers(sourceFile, "food");
      expect(printSchema(evaluateSchema(foodNodes[0], checker)))
        .toMatchInlineSnapshot(`
        "string;
        "
      `);
    });
    it("should evaluate index keys on literals", () => {
      const { checker, sourceFile } = testType(`
        export const appConfig: Record<string, string> = {
          food: "bar",
        };

        const food = appConfig.food;
        const accessFood = appConfig['food'];
        const bar = appConfig.bar;
        const bat = appConfig['bat'];
      `);

      const appConfigNodes = findIdentifiers(sourceFile, "appConfig");
      expect(printSchema(evaluateSchema(appConfigNodes[0], checker)))
        .toMatchInlineSnapshot(`
        "{
          food: \\"bar\\";
          [k: string]: string;
        };
        "
      `);

      const foodNodes = findIdentifiers(sourceFile, "food");
      expect(printSchema(evaluateSchema(foodNodes[0], checker)))
        .toMatchInlineSnapshot(`
        "\\"bar\\";
        "
      `);
      expect(printSchema(evaluateSchema(foodNodes[1], checker)))
        .toMatchInlineSnapshot(`
        "\\"bar\\";
        "
      `);

      const accessFoodNodes = findIdentifiers(sourceFile, "accessFood");
      expect(printSchema(evaluateSchema(accessFoodNodes[0], checker)))
        .toMatchInlineSnapshot(`
        "\\"bar\\";
        "
      `);

      const barNodes = findIdentifiers(sourceFile, "bar");
      expect(printSchema(evaluateSchema(barNodes[0], checker)))
        .toMatchInlineSnapshot(`
        "string;
        "
      `);

      const batNodes = findIdentifiers(sourceFile, "bat");
      expect(printSchema(evaluateSchema(batNodes[0], checker)))
        .toMatchInlineSnapshot(`
        "string;
        "
      `);
    });
  });
});
