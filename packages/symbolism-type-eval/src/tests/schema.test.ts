import { mockProgram } from "@symbolism/test";
import { findIdentifiers } from "@symbolism/ts-utils";
import { printSchema } from "../print/typescript";
import { convertTSTypeToSchema, SchemaContext } from "../schema";

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

// TODO: Use type references when a type is named
describe("type schema converter", () => {
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

    expect(
      printSchema(convertTSTypeToSchema(...context.clone(type, declaration)))
    ).toMatchInlineSnapshot(`
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
        void: void;
      };
      "
    `);
  });
  it("should merge intersections", () => {
    const { type, declaration, context } = testType(`
      type Generic<T> = {foo: T} | {bar: T};
      type GenericIntersection<T> = {foo: T} & {bar: T};
      type Type = {
        neverIntersection: 1 & 2 & 3;
        narrowIntersection: 1 & number;
        reducingIntersection: { foo: 4, bar: 5} & { foo: number };
        extendingIntersection: { foo: 4, bar: 5} & { food: number };
        mixedIntersection: 1 & { foo: number };
        genericIntersection: Generic<number> & Generic<string>;
        genericIntersectionWithIntersect: GenericIntersection<number> & GenericIntersection<string>;
        unknownIntersection: unknown & 1;
        nullIntersection: null & 1;
        emptyIntersection: {} & 1;
      };
    `);
    expect(
      printSchema(convertTSTypeToSchema(...context.clone(type, declaration)))
    ).toMatchInlineSnapshot(`
      "{
        emptyIntersection: 1 & {};
        extendingIntersection: {
          bar: 5;
          foo: 4;
          food: number;
        };
        genericIntersection:
          | {
              bar: number;
              foo: string;
            }
          | {
              bar: string;
              foo: number;
            }
          | { bar: never }
          | { foo: never };
        genericIntersectionWithIntersect: {
          bar: never;
          foo: never;
        };
        mixedIntersection: 1 & { foo: number };
        narrowIntersection: 1;
        neverIntersection: never;
        nullIntersection: never;
        reducingIntersection: {
          bar: 5;
          foo: 4;
        };
        unknownIntersection: 1;
      };
      "
    `);
  });

  it("should merge union", () => {
    const { type, declaration, context } = testType(`
      type Generic<T> = {foo: T} | {bar: T};
      type GenericIntersection<T> = {foo: T} & {bar: T};
      type Type = {
        directUnion: 1 | 2 | 3;
        wideningUnion: 1 | number;
        overlappingUnion: { foo: 4, bar: 5} | { foo: number };
        disjointUnion: { foo: 4, bar: 5} | { food: number };
        mixedUnion: 1 | { foo: number };
        genericUnion: Generic<number> | Generic<string>;
        genericUnionWithIntersect: GenericIntersection<number> | GenericIntersection<string>;
        unknownUnion: unknown | 1;
        nullUnion: null | 1;
        emptyUnion: {} | 1;
      };
    `);
    expect(
      printSchema(convertTSTypeToSchema(...context.clone(type, declaration)))
    ).toMatchInlineSnapshot(`
      "{
        directUnion: 1 | 2 | 3;
        disjointUnion:
          | {
              bar: 5;
              foo: 4;
            }
          | { food: number };
        emptyUnion: 1 | {};
        genericUnion:
          | { bar: number }
          | { bar: string }
          | { foo: number }
          | { foo: string };
        genericUnionWithIntersect:
          | {
              bar: number;
              foo: number;
            }
          | {
              bar: string;
              foo: string;
            };
        mixedUnion: 1 | { foo: number };
        nullUnion: 1;
        overlappingUnion:
          | {
              bar: 5;
              foo: 4;
            }
          | { foo: number };
        unknownUnion: unknown;
        wideningUnion: number;
      };
      "
    `);
  });

  describe("objects", () => {
    it("should handle interfaces and classes", () => {
      const { type, declaration, context } = testType(`
        interface CSSProps  {
          color?: string
          interfaceFunction: (foo: "bar") => string;
        }
        class NestedSelector  {
          prop: CSSProps;
          classFunction: () => void;
        }
        interface Type {
          nested?: NestedSelector
        }
      `);
      expect(
        printSchema(convertTSTypeToSchema(...context.clone(type, declaration)))
      ).toMatchInlineSnapshot(`
        "{
          nested: {
            classFunction: () => void;
            prop: {
              color: string;
              interfaceFunction: (foo: \\"bar\\") => string;
            };
          };
        };
        "
      `);
    });
    it("should handle index signatures", () => {
      const { type, declaration, context } = testType(`
        type Source = {
          directUnion: 1 | 2 | 3;
          wideningUnion: 1 | number;
        };
        type Type = {
          [key: string]: "foo" | "bar";
        } & {
          other: keyof Source;
        }
      `);
      expect(
        printSchema(convertTSTypeToSchema(...context.clone(type, declaration)))
      ).toMatchInlineSnapshot(`
        "{
          __index: \\"bar\\" | \\"foo\\";
          other: \\"directUnion\\" | \\"wideningUnion\\";
        };
        "
      `);
    });
    it("should handle mapped types", () => {
      // ts.ObjectFlags.Mapped;
      const { type, declaration, context } = testType(`
        type Source = {
          directUnion: 1 | 2 | 3;
          wideningUnion: 1 | number;
          overlappingUnion: { foo: 4, bar: 5} | { foo: number };
          disjointUnion: { foo: 4, bar: 5} | { food: number };
          mixedUnion: 1 | { foo: number };
        };
        type Type = {
          [key in keyof Source]: "foo" | "bar";
        }
      `);
      expect(
        printSchema(convertTSTypeToSchema(...context.clone(type, declaration)))
      ).toMatchInlineSnapshot(`
        "{
          directUnion: \\"bar\\" | \\"foo\\";
          disjointUnion: \\"bar\\" | \\"foo\\";
          mixedUnion: \\"bar\\" | \\"foo\\";
          overlappingUnion: \\"bar\\" | \\"foo\\";
          wideningUnion: \\"bar\\" | \\"foo\\";
        };
        "
      `);
    });

    it("should handle reverse mapped types", () => {
      // https://github.com/microsoft/TypeScript/blob/5d65c4dc26334ec7518d2472a9b3b69dac9ff2b5/tests/cases/compiler/reverseMappedTypeAssignableToIndex.ts#L1
      const { type, declaration, context } = testType(`
        // Simple mapped type and inferrence
        type Mapped<T> = { [K in keyof T]: { name: T[K] } };
        type InferFromMapped<T> = T extends Mapped<infer R> ? R : never;

        type MappedLiteralType = {
          first: { name: "first" },
          second: { name: "second" },
        };

        type Type = InferFromMapped<MappedLiteralType>;
      `);
      expect(
        printSchema(convertTSTypeToSchema(...context.clone(type, declaration)))
      ).toMatchInlineSnapshot(`
        "{
          first: \\"first\\";
          second: \\"second\\";
        };
        "
      `);
    });
    it("should handle well known objects", () => {
      const { type, declaration, context } = testType(`
        type Type = {
          date: Date;
        };
      `);

      expect(
        printSchema(convertTSTypeToSchema(...context.clone(type, declaration)))
      ).toMatchInlineSnapshot(`
        "{ date: \\"Date\\" };
        "
      `);
    });

    it("should handle circular types", () => {
      const { type, declaration, context } = testType(`
        type Type = {
          foo: Type;
          date: Date;
        };
      `);

      expect(
        printSchema(convertTSTypeToSchema(...context.clone(type, declaration)))
      ).toMatchInlineSnapshot(`
        "{
          date: \\"Date\\";
          foo: \\"error! Circular type\\";
        };
        "
      `);
    });
  });
  describe("arrays", () => {
    it("should pull type from array literals", () => {
      const { checker, context, sourceFile } = testType(`
        const x = [1, 2, 3];
      `);

      const xNodes = findIdentifiers(sourceFile, "x");

      let xType = checker.getTypeAtLocation(xNodes[0]);
      expect(
        printSchema(
          convertTSTypeToSchema(...context.clone(undefined, xNodes[0]))
        )
      ).toMatchInlineSnapshot(`
        "number[];
        "
      `);
    });

    it("should pull type from const array literals", () => {
      const { checker, context, sourceFile } = testType(`
        const x = [1, 2, 3] as const;
      `);

      const xNodes = findIdentifiers(sourceFile, "x");

      expect(
        printSchema(
          convertTSTypeToSchema(...context.clone(undefined, xNodes[0]))
        )
      ).toMatchInlineSnapshot(`
        "[1, 2, 3];
        "
      `);
    });
  });
  describe("tuples", () => {
    // (Tuple = 1 << 3), // Synthesized generic tuple type
    it("should pull type from tuples", () => {
      const { type, declaration, context } = testType(`
        type Type = [1, 2, 3];
      `);

      expect(
        printSchema(convertTSTypeToSchema(...context.clone(type, declaration)))
      ).toMatchInlineSnapshot(`
        "[1, 2, 3];
        "
      `);
    });
    it("should handle tuples with rest and optional", () => {
      const { type, declaration, context } = testType(`
        type Type = [1, 2, 3, ...string[], number?];
      `);

      expect(
        printSchema(convertTSTypeToSchema(...context.clone(type, declaration)))
      ).toMatchInlineSnapshot(`
        "[1, 2, 3, ...string[], number?];
        "
      `);
    });
    it("should handle variadic tuples", () => {
      const { type, declaration, context } = testType(`
        type GenericType<T> = [1, ...T];
        type Type = GenericType<[string, "bar"]>;
      `);

      expect(
        printSchema(convertTSTypeToSchema(...context.clone(type, declaration)))
      ).toMatchInlineSnapshot(`
        "[1, string, \\"bar\\"];
        "
      `);
    });
  });

  describe("generics", () => {
    it("should handle resolved generics", () => {
      const { type, declaration, context } = testType(`
          interface CSSProps  {
            color?: string;
            backgroundColor?: string;
          }
          interface NestedSelector<T extends CSSProps>  {
            prop: T;
          }
          interface GenericType<T extends CSSProps> {
            nested?: NestedSelector<T>
          }

          type Type = GenericType<{ color: "red" }>;
        `);
      expect(
        printSchema(convertTSTypeToSchema(...context.clone(type, declaration)))
      ).toMatchInlineSnapshot(`
        "{ nested: { prop: { color: \\"red\\" } } };
        "
      `);
    });
    it("should handle implicitly resolved generics", () => {
      const { type, declaration, context } = testType(`
          interface CSSProps  {
            color?: string;
            backgroundColor?: string;
          }
          interface NestedSelector<T extends CSSProps>  {
            prop: T;
          }
          interface Type<T extends CSSProps> {
            nested?: NestedSelector<T>
          }
        `);
      expect(
        printSchema(convertTSTypeToSchema(...context.clone(type, declaration)))
      ).toMatchInlineSnapshot(`
        "{
          nested: {
            prop: {
              backgroundColor: string;
              color: string;
            };
          };
        };
        "
      `);
    });
    it("should handle unresolved generics", () => {
      const { type, declaration, context } = testType(`
          interface NestedSelector<T>  {
            prop: T;
          }
          interface Type<T extends CSSProps> {
            nested?: NestedSelector<T>
          }
        `);
      expect(
        printSchema(convertTSTypeToSchema(...context.clone(type, declaration)))
      ).toMatchInlineSnapshot(`
        "{ nested: { prop: any } };
        "
      `);
    });
  });

  describe("template literal types", () => {
    it("should handle template literal types", () => {
      const { type, declaration, context } = testType(`
        type Bar = string;
        type Type = \`foo \${Bar}\`;
      `);

      expect(
        printSchema(convertTSTypeToSchema(...context.clone(type, declaration)))
      ).toMatchInlineSnapshot(`
        "\`foo \${string}\`;
        "
      `);
    });
    it("should flatten concrete templates", () => {
      const { type, declaration, context } = testType(`
        type Bar = "foo" | "bar";
        type Type = \`foo \${Bar}\`;
      `);

      expect(
        printSchema(convertTSTypeToSchema(...context.clone(type, declaration)))
      ).toMatchInlineSnapshot(`
        "\\"foo bar\\" | \\"foo foo\\";
        "
      `);
    });
    it("should load types from runtime code", () => {
      const { type, declaration, context } = testType(`
        declare const bar: "foo" | "bar";
        const foo = \`foo \${bar}\`
        const type = \`\${foo}d\`
        type Type = typeof type;
      `);

      expect(
        printSchema(convertTSTypeToSchema(...context.clone(type, declaration)))
      ).toMatchInlineSnapshot(`
        "\\"foo bard\\" | \\"foo food\\";
        "
      `);
    });
    it("should load types from runtime code", () => {
      const { type, declaration, context } = testType(`
        declare const bar: "foo" | "bar";
        const foo = \`foo \${bar}\`
        const type = {
          foo: \`\${foo}d\`
        }
        type Type = typeof type;
      `);

      expect(
        printSchema(convertTSTypeToSchema(...context.clone(type, declaration)))
      ).toMatchInlineSnapshot(`
        "{ foo: \\"foo bard\\" | \\"foo food\\" };
        "
      `);
    });
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

    expect(
      printSchema(convertTSTypeToSchema(...context.clone(type, declaration)))
    ).toMatchInlineSnapshot(`
      "{}[keyof {}];
      "
    `);
  });

  it.todo("should convert calls to schema parameters");

  describe("runtime narrowing", () => {
    it("should narrow string binary operations", () => {
      const { type, declaration, checker, sourceFile } = testType(`
        type Source = {
          directUnion: 1 | 2 | 3;
        };
        declare const source: Source;

        const add = source.directUnion + "foo";
        const addNumber = source.directUnion + 1;
        const subtract = source.directUnion - "foo";
        const subtractNumber = source.directUnion - 1;
        const multiply = source.directUnion * 2;
        const divide = source.directUnion / 2;
        const modulo = source.directUnion % 2;
        const exponent = source.directUnion ** 2;
        const equals = source.directUnion === "foo";
        const notEquals = source.directUnion !== "foo";
        const lessThan = source.directUnion < "foo";
        const lessThanOrEqual = source.directUnion <= "foo";
        const greaterThan = source.directUnion > "foo";
        const greaterThanOrEqual = source.directUnion >= "foo";
        const inOperator = "foo" in source.directUnion;
        const instanceOf = source.directUnion instanceof String;
      `);

      expect(testNode("add")).toMatchInlineSnapshot(`
        "\\"1foo\\" | \\"2foo\\" | \\"3foo\\";
        "
      `);
      expect(testNode("addNumber")).toMatchInlineSnapshot(`
        "2 | 3 | 4;
        "
      `);
      expect(testNode("subtract")).toMatchInlineSnapshot(`
        "NaN | NaN | NaN;
        "
      `);
      expect(testNode("subtractNumber")).toMatchInlineSnapshot(`
        "0 | 1 | 2;
        "
      `);

      expect(testNode("multiply")).toMatchInlineSnapshot(`
        "2 | 4 | 6;
        "
      `);
      expect(testNode("divide")).toMatchInlineSnapshot(`
        "0.5 | 1 | 1.5;
        "
      `);
      expect(testNode("modulo")).toMatchInlineSnapshot(`
        "0 | 1 | 1;
        "
      `);
      expect(testNode("exponent")).toMatchInlineSnapshot(`
        "1 | 4 | 9;
        "
      `);

      expect(testNode("equals")).toMatchInlineSnapshot(`
        "false | true;
        "
      `);
      expect(testNode("notEquals")).toMatchInlineSnapshot(`
        "false | true;
        "
      `);
      expect(testNode("lessThan")).toMatchInlineSnapshot(`
        "false | true;
        "
      `);
      expect(testNode("lessThanOrEqual")).toMatchInlineSnapshot(`
        "false | true;
        "
      `);
      expect(testNode("greaterThan")).toMatchInlineSnapshot(`
        "false | true;
        "
      `);
      expect(testNode("greaterThanOrEqual")).toMatchInlineSnapshot(`
        "false | true;
        "
      `);

      expect(testNode("inOperator")).toMatchInlineSnapshot(`
        "false | true;
        "
      `);
      expect(testNode("instanceOf")).toMatchInlineSnapshot(`
        "false | true;
        "
      `);

      function testNode(name: string) {
        const nodes = findIdentifiers(sourceFile, name);
        const type = checker.getTypeAtLocation(nodes[0]);
        return printSchema(
          convertTSTypeToSchema(type, new SchemaContext(nodes[0], checker))
        );
      }
    });
  });
});
