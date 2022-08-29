import { mockProgram } from "@symbolism/test";
import { findIdentifiers, findNodesInTree } from "@symbolism/ts-utils";
import { printSchema } from "../print/typescript";
import { SchemaContext } from "../context";
import ts from "typescript";
import { evaluateSchema } from "../schema";
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
      expect(printSchema(evaluateSchema(returnNodes[0], context.checker)))
        .toMatchInlineSnapshot(`
        "\\"foo\\";
        "
      `);

      expect(printSchema(evaluateSchema(returnNodes[1], context.checker)))
        .toMatchInlineSnapshot(`
        "\\"bat\\";
        "
      `);

      expect(printSchema(evaluateSchema(returnNodes[2], context.checker)))
        .toMatchInlineSnapshot(`
        "\\"bar\\";
        "
      `);
      expect(printSchema(evaluateSchema(returnNodes[3], context.checker)))
        .toMatchInlineSnapshot(`
        "undefined;
        "
      `);

      const arrowNodes = findIdentifiers(sourceFile, "arrow");
      expect(printSchema(evaluateSchema(arrowNodes[0], context.checker)))
        .toMatchInlineSnapshot(`
        "() => \\"foo\\";
        "
      `);

      const fooNodes = findIdentifiers(sourceFile, "foo");
      expect(printSchema(evaluateSchema(fooNodes[0], context.checker)))
        .toMatchInlineSnapshot(`
        "() => \\"foo\\";
        "
      `);

      const barNodes = findIdentifiers(sourceFile, "bar");
      expect(printSchema(evaluateSchema(barNodes[0], context.checker)))
        .toMatchInlineSnapshot(`
        "() => \\"bar\\" | \\"bat\\";
        "
      `);
    });
    it("should evaluate yield in generators", () => {
      const { type, context, sourceFile } = testType(`
        function foo() {
          throw 'bar';
        }
      `);

      const throwNodes = findNodesInTree(sourceFile, ts.isThrowStatement);
      expect(printSchema(evaluateSchema(throwNodes[0], context.checker)))
        .toMatchInlineSnapshot(`
        "\\"bar\\";
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
      expect(printSchema(evaluateSchema(yieldNodes[0], context.checker)))
        .toMatchInlineSnapshot(`
        "\\"foo\\";
        "
      `);
      expect(
        printSchema(
          evaluateSchema(yieldNodes[yieldNodes.length - 1], context.checker)
        )
      ).toMatchInlineSnapshot(`
        "type Generator<\\"foo\\" | \\"bar\\", void, unknown> = {
          \\"[Symbol.iterator]\\": () => Generator<\\"bar\\" | \\"foo\\", undefined, unknown>;
          next: (
            args: [{}] | []
          ) => IteratorReturnResult<undefined> | IteratorYieldResult<\\"bar\\" | \\"foo\\">;
          return: (value: {}) => IteratorResult<\\"bar\\" | \\"foo\\", undefined>;
          throw: (e: any) => IteratorResult<\\"bar\\" | \\"foo\\", undefined>;
        };

        type IteratorResult<\\"foo\\" | \\"bar\\", void> = IteratorReturnResult<undefined> | IteratorYieldResult<\\"bar\\" | \\"foo\\">;

        type IteratorReturnResult<void> = {
          done: true;
          value: undefined;
        };

        type IteratorYieldResult<\\"foo\\" | \\"bar\\"> = {
          done: false;
          value: \\"bar\\" | \\"foo\\";
        };

        Generator<\\"bar\\" | \\"foo\\", undefined, unknown>;
        "
      `);

      const fooNodes = findIdentifiers(sourceFile, "foo");
      expect(printSchema(evaluateSchema(fooNodes[0], context.checker)))
        .toMatchInlineSnapshot(`
        "type Generator<\\"foo\\" | \\"bar\\", void, unknown> = {
          \\"[Symbol.iterator]\\": () => Generator<\\"bar\\" | \\"foo\\", undefined, unknown>;
          next: (
            args: [{}] | []
          ) => IteratorReturnResult<undefined> | IteratorYieldResult<\\"bar\\" | \\"foo\\">;
          return: (value: {}) => IteratorResult<\\"bar\\" | \\"foo\\", undefined>;
          throw: (e: any) => IteratorResult<\\"bar\\" | \\"foo\\", undefined>;
        };

        type IteratorResult<\\"foo\\" | \\"bar\\", void> = IteratorReturnResult<undefined> | IteratorYieldResult<\\"bar\\" | \\"foo\\">;

        type IteratorReturnResult<void> = {
          done: true;
          value: undefined;
        };

        type IteratorYieldResult<\\"foo\\" | \\"bar\\"> = {
          done: false;
          value: \\"bar\\" | \\"foo\\";
        };

        () => Generator<\\"bar\\" | \\"foo\\", undefined, unknown>;
        "
      `);
      expect(printSchema(evaluateSchema(fooNodes[1], context.checker)))
        .toMatchInlineSnapshot(`
        "type Generator<\\"foo\\" | \\"bar\\", void, unknown> = {
          \\"[Symbol.iterator]\\": () => Generator<\\"bar\\" | \\"foo\\", undefined, unknown>;
          next: (
            args: [{}] | []
          ) => IteratorReturnResult<undefined> | IteratorYieldResult<\\"bar\\" | \\"foo\\">;
          return: (value: {}) => IteratorResult<\\"bar\\" | \\"foo\\", undefined>;
          throw: (e: any) => IteratorResult<\\"bar\\" | \\"foo\\", undefined>;
        };

        type IteratorResult<\\"foo\\" | \\"bar\\", void> = IteratorReturnResult<undefined> | IteratorYieldResult<\\"bar\\" | \\"foo\\">;

        type IteratorReturnResult<void> = {
          done: true;
          value: undefined;
        };

        type IteratorYieldResult<\\"foo\\" | \\"bar\\"> = {
          done: false;
          value: \\"bar\\" | \\"foo\\";
        };

        () => Generator<\\"bar\\" | \\"foo\\", undefined, unknown>;
        "
      `);
    });
    it("should infer return from iterators", () => {
      const { type, context, sourceFile } = testType(`
        function* generator() {
          yield "foo";
          yield "bar";
          return "bat" as const;
        }

        function foo() {
          const iterator = generator();
          const iteratorResult = iterator.next();
          const values = iteratorResult.value;
          return iterator.next().value;
        }
      `);

      const iteratorNodes = findIdentifiers(sourceFile, "iterator");
      expect(printSchema(evaluateSchema(iteratorNodes[0], context.checker)))
        .toMatchInlineSnapshot(`
        "type Generator<\\"foo\\" | \\"bar\\", \\"bat\\", unknown> = {
          \\"[Symbol.iterator]\\": () => Generator<\\"bar\\" | \\"foo\\", \\"bat\\", unknown>;
          next: (
            args: [{}] | []
          ) => IteratorReturnResult<\\"bat\\"> | IteratorYieldResult<\\"bar\\" | \\"foo\\">;
          return: (value: {}) => IteratorResult<\\"bar\\" | \\"foo\\", \\"bat\\">;
          throw: (e: any) => IteratorResult<\\"bar\\" | \\"foo\\", \\"bat\\">;
        };

        type IteratorResult<\\"foo\\" | \\"bar\\", \\"bat\\"> = IteratorReturnResult<\\"bat\\"> | IteratorYieldResult<\\"bar\\" | \\"foo\\">;

        type IteratorReturnResult<\\"bat\\"> = {
          done: true;
          value: \\"bat\\";
        };

        type IteratorYieldResult<\\"foo\\" | \\"bar\\"> = {
          done: false;
          value: \\"bar\\" | \\"foo\\";
        };

        Generator<\\"bar\\" | \\"foo\\", \\"bat\\", unknown>;
        "
      `);

      const fooNodes = findIdentifiers(sourceFile, "foo");
      expect(printSchema(evaluateSchema(fooNodes[0], context.checker)))
        .toMatchInlineSnapshot(`
        "() => \\"bar\\" | \\"bat\\" | \\"foo\\";
        "
      `);

      const valuesNodes = findIdentifiers(sourceFile, "values");
      expect(printSchema(evaluateSchema(valuesNodes[0], context.checker)))
        .toMatchInlineSnapshot(`
        "\\"bar\\" | \\"bat\\" | \\"foo\\";
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
      expect(printSchema(evaluateSchema(awaitReturnNode, context.checker)))
        .toMatchInlineSnapshot(`
        "\\"foo\\";
        "
      `);

      const [fooDeclaration] = findIdentifiers(sourceFile, "foo");
      expect(dumpNode(fooDeclaration, context.checker)).toMatchInlineSnapshot(`
        Object {
          "kind": "Identifier",
          "location": "test.ts:2:15",
          "name": "foo",
          "path": "foo",
        }
      `);
      expect(printSchema(evaluateSchema(fooDeclaration, context.checker)))
        .toMatchInlineSnapshot(`
        "() => Promise<\\"foo\\">;
        "
      `);

      const [awaitedDeclaration] = findIdentifiers(sourceFile, "awaited");
      expect(printSchema(evaluateSchema(awaitedDeclaration, context.checker)))
        .toMatchInlineSnapshot(`
        "\\"foo\\";
        "
      `);

      const [notAwaitedDeclaration] = findIdentifiers(sourceFile, "notAwaited");
      expect(
        printSchema(evaluateSchema(notAwaitedDeclaration, context.checker))
      ).toMatchInlineSnapshot(`
        "Promise<\\"foo\\">;
        "
      `);

      const [barDeclaration] = findIdentifiers(sourceFile, "bar");
      expect(printSchema(evaluateSchema(barDeclaration, context.checker)))
        .toMatchInlineSnapshot(`
        "() => Promise<\\"bar\\" | \\"foo\\">;
        "
      `);
    });
  });
});
