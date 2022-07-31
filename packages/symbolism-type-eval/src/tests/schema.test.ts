import { mockProgram } from "@symbolism/test";
import { findIdentifiers } from "@symbolism/ts-utils";
import { printSchema } from "../print";
import { convertTSTypeToSchema } from "../schema";

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
    checker,
  };
}

// TODO: Use type references when a type is named
describe("type schema converter", () => {
  it("should convert direct types to a schema", () => {
    const { type, declaration, checker } = testType(`
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

    expect(printSchema(convertTSTypeToSchema(type, declaration, checker)))
      .toMatchInlineSnapshot(`
      "type foo = {
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
    const { type, declaration, checker } = testType(`
      type Type = {
        neverIntersection: 1 & 2 & 3;
        narrowIntersection: 1 & number;
        reducingIntersection: { foo: 4, bar: 5} & { foo: number };
        extendingIntersection: { foo: 4, bar: 5} & { food: number };
        mixedIntersection: 1 & { foo: number };
      };
    `);
    expect(printSchema(convertTSTypeToSchema(type, declaration, checker)))
      .toMatchInlineSnapshot(`
      "type foo = {
        extendingIntersection: {
          bar: 5;
          foo: 4;
          food: number;
        };
        mixedIntersection: 1 & { foo: number };
        narrowIntersection: 1;
        neverIntersection: never;
        reducingIntersection: {
          bar: 5;
          foo: 4;
        };
      };
      "
    `);
  });

  it("should merge union", () => {
    const { type, declaration, checker } = testType(`
      type Type = {
        directUnion: 1 | 2 | 3;
        wideningUnion: 1 | number;
        overlappingUnion: { foo: 4, bar: 5} | { foo: number };
        disjointUnion: { foo: 4, bar: 5} | { food: number };
        mixedUnion: 1 | { foo: number };
      };
    `);
    expect(printSchema(convertTSTypeToSchema(type, declaration, checker)))
      .toMatchInlineSnapshot(`
      "type foo = {
        directUnion: 1 | 2 | 3;
        disjointUnion:
          | {
              bar: 5;
              foo: 4;
            }
          | { food: number };
        mixedUnion: 1 | { foo: number };
        overlappingUnion:
          | {
              bar: 5;
              foo: 4;
            }
          | { foo: number };
        wideningUnion: number;
      };
      "
    `);
  });

  describe("objects", () => {
    it("should handle interfaces and classes", () => {
      const { type, declaration, checker } = testType(`
        interface CSSProps  {
          color?: string
        }
        class NestedSelector  {
          prop: CSSProps;
        }
        interface Type {
          nested?: NestedSelector
        }
      `);
      expect(printSchema(convertTSTypeToSchema(type, declaration, checker)))
        .toMatchInlineSnapshot(`
        "type foo = { nested: { prop: { color: string } } };
        "
      `);
    });
    it.todo("should handle index signatures");
    it("should handle mapped types", () => {
      // ts.ObjectFlags.Mapped;
      const { type, declaration, checker } = testType(`
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
      expect(printSchema(convertTSTypeToSchema(type, declaration, checker)))
        .toMatchInlineSnapshot(`
        "type foo = {
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
      const { type, declaration, checker } = testType(`
        // Simple mapped type and inferrence
        type Mapped<T> = { [K in keyof T]: { name: T[K] } };
        type InferFromMapped<T> = T extends Mapped<infer R> ? R : never;

        type MappedLiteralType = {
          first: { name: "first" },
          second: { name: "second" },
        };

        type Type = InferFromMapped<MappedLiteralType>;
      `);
      expect(printSchema(convertTSTypeToSchema(type, declaration, checker)))
        .toMatchInlineSnapshot(`
        "type foo = {
          first: \\"first\\";
          second: \\"second\\";
        };
        "
      `);
    });
    it("should handle well known objects", () => {
      const { type, declaration, checker } = testType(`
        type Type = {
          date: Date;
        };
      `);

      expect(printSchema(convertTSTypeToSchema(type, declaration, checker)))
        .toMatchInlineSnapshot(`
        "type foo = { date: \\"Date\\" };
        "
      `);
    });
  });
  it.todo("should convert calls to schema parameters");
  it.todo("should infer type from template string value");
  it.todo("should narrow based on executed code");
});
