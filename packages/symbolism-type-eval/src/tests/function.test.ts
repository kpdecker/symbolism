import { mockProgram } from "@symbolism/test";
import { findIdentifiers, findNodesInTree } from "@symbolism/ts-utils";
import { printSchema } from "../print/typescript";
import { SchemaContext } from "../context";
import ts from "typescript";
import { createJsonSchema } from "../print/json";
import { getNodeSchema } from "../value-eval";
import { evaluateSchema } from "../schema";
import { getTypeSchema } from "../type-eval";
import { dumpNode } from "@symbolism/ts-debug";

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
  describe("functions", () => {
    it("should evaluate return", () => {
      const { type, context, sourceFile } = testType(`
        const foo = function() {
          return 'foo';
        };

        const arrow = () => 'foo';

        function bar() {
          if (foo()) {
            return 'bat';
          }
          return 'bar';
        }

        function baz() {
          return;
        }
      `);

      const returnNodes = findNodesInTree(sourceFile, ts.isReturnStatement);
      expect(printSchema(getNodeSchema(...context.cloneNode(returnNodes[0]))))
        .toMatchInlineSnapshot(`
        "\\"foo\\";
        "
      `);

      expect(printSchema(getNodeSchema(...context.cloneNode(returnNodes[1]))))
        .toMatchInlineSnapshot(`
        "\\"bat\\";
        "
      `);

      expect(printSchema(getNodeSchema(...context.cloneNode(returnNodes[2]))))
        .toMatchInlineSnapshot(`
        "\\"bar\\";
        "
      `);
      expect(printSchema(getNodeSchema(...context.cloneNode(returnNodes[3]))))
        .toMatchInlineSnapshot(`
        "undefined;
        "
      `);

      const arrowNodes = findIdentifiers(sourceFile, "arrow");
      expect(printSchema(getNodeSchema(...context.cloneNode(arrowNodes[0]))))
        .toMatchInlineSnapshot(`
        "() => \\"foo\\";
        "
      `);

      const fooNodes = findIdentifiers(sourceFile, "foo");
      expect(printSchema(getNodeSchema(...context.cloneNode(fooNodes[0]))))
        .toMatchInlineSnapshot(`
        "() => \\"foo\\";
        "
      `);

      const barNodes = findIdentifiers(sourceFile, "bar");
      expect(printSchema(getNodeSchema(...context.cloneNode(barNodes[0]))))
        .toMatchInlineSnapshot(`
        "() => \\"bar\\" | \\"bat\\";
        "
      `);
    });
    it("should evaluate yield in generators", () => {
      const { type, context, sourceFile } = testType(`
        function* foo() {
          yield 'foo';
          yield 'bar';
        }

        function *bar() {
          yield 'food';
          yield *foo();
        }
      `);

      const yieldNodes = findNodesInTree(sourceFile, ts.isYieldExpression);
      expect(printSchema(getNodeSchema(...context.cloneNode(yieldNodes[0]))))
        .toMatchInlineSnapshot(`
        "\\"foo\\";
        "
      `);
      expect(
        printSchema(
          getNodeSchema(...context.cloneNode(yieldNodes[yieldNodes.length - 1]))
        )
      ).toMatchInlineSnapshot(`
        "{
          \\"[Symbol.iterator]\\": () => 'error! Circular type Generator<\\"foo\\" | \\"bar\\", void, unknown>';
          next: (args: [{}] | []) =>
            | {
                done: false;
                value: \\"bar\\" | \\"foo\\";
              }
            | {
                done: true;
                value: undefined;
              };
          return: (value: {}) =>
            | {
                done: false;
                value: \\"bar\\" | \\"foo\\";
              }
            | {
                done: true;
                value: undefined;
              };
          throw: (e: any) =>
            | {
                done: false;
                value: \\"bar\\" | \\"foo\\";
              }
            | {
                done: true;
                value: undefined;
              };
        };
        "
      `);

      const fooNodes = findIdentifiers(sourceFile, "foo");
      expect(printSchema(getNodeSchema(...context.cloneNode(fooNodes[0]))))
        .toMatchInlineSnapshot(`
        "() => {
          \\"[Symbol.iterator]\\": () => 'error! Circular type Generator<\\"foo\\" | \\"bar\\", void, unknown>';
          next: (args: [{}] | []) =>
            | {
                done: false;
                value: \\"bar\\" | \\"foo\\";
              }
            | {
                done: true;
                value: undefined;
              };
          return: (value: {}) =>
            | {
                done: false;
                value: \\"bar\\" | \\"foo\\";
              }
            | {
                done: true;
                value: undefined;
              };
          throw: (e: any) =>
            | {
                done: false;
                value: \\"bar\\" | \\"foo\\";
              }
            | {
                done: true;
                value: undefined;
              };
        };
        "
      `);
      expect(printSchema(getNodeSchema(...context.cloneNode(fooNodes[1]))))
        .toMatchInlineSnapshot(`
        "() => {
          \\"[Symbol.iterator]\\": () => 'error! Circular type Generator<\\"foo\\" | \\"bar\\", void, unknown>';
          next: (args: [{}] | []) =>
            | {
                done: false;
                value: \\"bar\\" | \\"foo\\";
              }
            | {
                done: true;
                value: undefined;
              };
          return: (value: {}) =>
            | {
                done: false;
                value: \\"bar\\" | \\"foo\\";
              }
            | {
                done: true;
                value: undefined;
              };
          throw: (e: any) =>
            | {
                done: false;
                value: \\"bar\\" | \\"foo\\";
              }
            | {
                done: true;
                value: undefined;
              };
        };
        "
      `);

      const barNodes = findIdentifiers(sourceFile, "bar");
      expect(printSchema(getNodeSchema(...context.cloneNode(barNodes[0]))))
        .toMatchInlineSnapshot(`
        "() => {
          \\"[Symbol.iterator]\\": () => 'error! Circular type Generator<\\"foo\\" | \\"bar\\" | \\"food\\", void, unknown>';
          next: (args: [{}] | []) =>
            | {
                done: false;
                value: \\"bar\\" | \\"foo\\" | \\"food\\";
              }
            | {
                done: true;
                value: undefined;
              };
          return: (value: {}) =>
            | {
                done: false;
                value: \\"bar\\" | \\"foo\\" | \\"food\\";
              }
            | {
                done: true;
                value: undefined;
              };
          throw: (e: any) =>
            | {
                done: false;
                value: \\"bar\\" | \\"foo\\" | \\"food\\";
              }
            | {
                done: true;
                value: undefined;
              };
        };
        "
      `);
    });
    it("should evaluate await", () => {
      const { type, context, sourceFile } = testType(`
        const foo = async function() {
          return 'foo';
        };

        async function bar() {
          if (await foo()) {
            return await foo();
          }

          const awaited = await foo();
          const notAwaited = foo();
          return 'bar';
        }
      `);

      const [, awaitReturnNode] = findNodesInTree(
        sourceFile,
        ts.isReturnStatement
      );
      expect(printSchema(getNodeSchema(...context.cloneNode(awaitReturnNode))))
        .toMatchInlineSnapshot(`
        "\\"foo\\";
        "
      `);

      const [fooDeclaration] = findIdentifiers(sourceFile, "foo");
      expect(dumpNode(fooDeclaration, context.checker)).toMatchInlineSnapshot(`
        Object {
          "column": 15,
          "fileName": "test.ts",
          "kind": "Identifier",
          "line": 2,
          "name": "foo",
          "path": "foo",
        }
      `);
      expect(printSchema(getNodeSchema(...context.cloneNode(fooDeclaration))))
        .toMatchInlineSnapshot(`
        "() => Promise<\\"foo\\">;
        "
      `);

      const [awaitedDeclaration] = findIdentifiers(sourceFile, "awaited");
      expect(
        printSchema(getNodeSchema(...context.cloneNode(awaitedDeclaration)))
      ).toMatchInlineSnapshot(`
        "\\"foo\\";
        "
      `);

      const [notAwaitedDeclaration] = findIdentifiers(sourceFile, "notAwaited");
      expect(
        printSchema(getNodeSchema(...context.cloneNode(notAwaitedDeclaration)))
      ).toMatchInlineSnapshot(`
        "Promise<\\"foo\\">;
        "
      `);

      const [barDeclaration] = findIdentifiers(sourceFile, "bar");
      expect(printSchema(getNodeSchema(...context.cloneNode(barDeclaration))))
        .toMatchInlineSnapshot(`
        "() => Promise<\\"bar\\" | \\"foo\\">;
        "
      `);
    });
  });
});
