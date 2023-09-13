import { mockProgram } from "@noom/symbolism-test";
import { findIdentifiers } from "@noom/symbolism-ts-utils";
import { printSchema } from "../print/typescript";
import { SchemaContext } from "../context";
import { evaluateSchema } from "../schema";

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
  describe("arrays", () => {
    it("should pull type from array literals", () => {
      const { checker, sourceFile } = testType(`
        const x = [1, 2, 3];
      `);

      const xNodes = findIdentifiers(sourceFile, "x");

      expect(printSchema(evaluateSchema(xNodes[0], checker)))
        .toMatchInlineSnapshot(`
        "(1 | 2 | 3)[];
        "
      `);
    });
    it("should pull type from empty array literals", () => {
      const { checker, sourceFile } = testType(`
        const x = [];
      `);

      const xNodes = findIdentifiers(sourceFile, "x");

      expect(printSchema(evaluateSchema(xNodes[0], checker)))
        .toMatchInlineSnapshot(`
        "any[];
        "
      `);
    });
    it("should pull type from spread elements", () => {
      const { checker, sourceFile } = testType(`
        const x = [1, 2, 3];
        const y = [4, ...x];
      `);

      const xNodes = findIdentifiers(sourceFile, "y");

      expect(printSchema(evaluateSchema(xNodes[0], checker)))
        .toMatchInlineSnapshot(`
        "(1 | 2 | 3 | 4)[];
        "
      `);
    });

    it("should pull type from const array literals", () => {
      const { checker, sourceFile } = testType(`
        const x = [1, 2, 3] as const;
      `);

      const xNodes = findIdentifiers(sourceFile, "x");

      expect(printSchema(evaluateSchema(xNodes[0], checker)))
        .toMatchInlineSnapshot(`
        "[1, 2, 3];
        "
      `);
    });
  });
  describe("tuples", () => {
    // (Tuple = 1 << 3), // Synthesized generic tuple type
    it("should pull type from tuples", () => {
      const { declaration, context } = testType(`
        type Type = [1, 2, 3];
      `);

      expect(printSchema(evaluateSchema(declaration, context.checker)))
        .toMatchInlineSnapshot(`
        "[1, 2, 3];
        "
      `);
    });
    it("should handle tuples with rest and optional", () => {
      const { declaration, context } = testType(`
        type Type = [1, 2, 3, ...string[], number?];
      `);

      expect(printSchema(evaluateSchema(declaration, context.checker)))
        .toMatchInlineSnapshot(`
        "[1, 2, 3, ...string[], number?];
        "
      `);
    });
    it("should handle variadic tuples", () => {
      const { declaration, context } = testType(`
        type GenericType<T> = [1, ...T];
        type Type = GenericType<[string, "bar"]>;
      `);

      expect(printSchema(evaluateSchema(declaration, context.checker)))
        .toMatchInlineSnapshot(`
        "[1, string, \\"bar\\"];
        "
      `);
    });
  });

  describe("binding", () => {
    it("should resolve variable binding", () => {
      const { declaration, context, sourceFile } = testType(`
        type GenericType<T> = [1, ...T];
        type Type = GenericType<[string, "bar"]>;

        declare const foo: Type;

        const [, x, y] = foo;
      `);

      expect(printSchema(evaluateSchema(declaration, context.checker)))
        .toMatchInlineSnapshot(`
        "[1, string, \\"bar\\"];
        "
      `);
      const xNodes = findIdentifiers(sourceFile, "x");
      expect(printSchema(evaluateSchema(xNodes[0], context.checker)))
        .toMatchInlineSnapshot(`
        "string;
        "
      `);
      const yNodes = findIdentifiers(sourceFile, "y");
      expect(printSchema(evaluateSchema(yNodes[0], context.checker)))
        .toMatchInlineSnapshot(`
        "\\"bar\\";
        "
      `);
    });
  });
});
