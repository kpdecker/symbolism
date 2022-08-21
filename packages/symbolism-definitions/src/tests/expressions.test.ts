import { dumpDefinition } from "@symbolism/ts-debug";
import { findIdentifiers, findNodeInTree } from "@symbolism/ts-utils";
import ts from "typescript";
import { mockProgram, testExpression, testStatement } from "../../test/utils";
import { defineSymbol } from "../index";

describe("infer expressions", () => {
  it("should handle var statements", () => {
    expect(testStatement("delete foo.bar")).toMatchInlineSnapshot(`
      Object {
        "symbol": undefined,
        "type": "boolean",
      }
    `);
  });
  it("should handle await expressions", () => {
    const program = mockProgram({
      "test.ts": `
        type Test = {};
        async function foo(): Promise<Test> {
          return {};
        }

        var bar = (await foo());
      `,
    });
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile("test.ts")!;

    const fooNodes = findIdentifiers(sourceFile, "foo");

    expect(dumpDefinition(defineSymbol(fooNodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 9,
            "fileName": "test.ts",
            "kind": "FunctionDeclaration",
            "line": 3,
            "name": "foo",
            "path": "foo",
          },
        ],
        "type": "() => Promise<Test>",
      }
    `);

    const barNodes = findIdentifiers(sourceFile, "bar");
    expect(dumpDefinition(defineSymbol(barNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 13,
            "fileName": "test.ts",
            "kind": "VariableDeclaration",
            "line": 7,
            "name": "bar = (await foo())",
            "path": "bar",
          },
        ],
        "type": "Test",
      }
    `);

    const awaitNode = findNodeInTree(sourceFile, ts.isAwaitExpression)!;
    expect(dumpDefinition(defineSymbol(awaitNode.parent, checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 21,
            "fileName": "test.ts",
            "kind": "TypeLiteral",
            "line": 2,
            "name": "{}",
            "path": "Test",
          },
        ],
        "type": "Test",
      }
    `);
  });
  it("should handle template expressions", () => {
    expect(testExpression("`foo${true}`")).toMatchInlineSnapshot(`
      Object {
        "symbol": undefined,
        "type": "string",
      }
    `);
  });
  it("should handle comma binary expression", () => {
    expect(testExpression("(Error,Promise,console)")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 1,
            "fileName": "typescript/lib/lib.dom.d.ts",
            "kind": "InterfaceDeclaration",
            "line": 17154,
            "name": "interface Console {",
            "path": "Console",
          },
        ],
        "type": "Console",
      }
    `);
  });

  it("should handle logical binary expressions", () => {
    expect(testExpression("(Error && console)")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 1,
            "fileName": "typescript/lib/lib.dom.d.ts",
            "kind": "InterfaceDeclaration",
            "line": 17154,
            "name": "interface Console {",
            "path": "Console",
          },
        ],
        "type": "Console",
      }
    `);
  });

  it("should handle logical binary expressions", () => {
    expect(testExpression("(Error < console)")).toMatchInlineSnapshot(`
      Object {
        "symbol": undefined,
        "type": "boolean",
      }
    `);
  });

  it("should handle postfix expression", () => {
    expect(testExpression("console++")).toMatchInlineSnapshot(`
      Object {
        "symbol": undefined,
        "type": "number",
      }
    `);
  });

  it("should handle not null expression", () => {
    expect(testExpression("console!")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 13,
            "fileName": "typescript/lib/lib.dom.d.ts",
            "kind": "VariableDeclaration",
            "line": 17177,
            "name": "console: Console",
            "path": "console",
          },
        ],
        "type": "Console",
      }
    `);
  });
  it("should handle element access expression", () => {
    expect(testExpression('console["log"]')).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 5,
            "fileName": "typescript/lib/lib.dom.d.ts",
            "kind": "MethodSignature",
            "line": 17167,
            "name": "log(...data: any[]): void;",
            "path": "Console.log",
          },
        ],
        "type": "(...data: any[]) => void",
      }
    `);
  });

  it("should handle conditional expression", () => {
    const program = mockProgram({
      "test.ts": "var bar = console ? Error : Promise;",
    });
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile("test.ts")!;
    const node = findNodeInTree(sourceFile, ts.isVariableDeclaration);

    expect(dumpDefinition(defineSymbol(node?.initializer!, checker)!, checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": undefined,
        "type": "ErrorConstructor | PromiseConstructor",
      }
    `);

    const consoleNodes = findIdentifiers(sourceFile, "console");
    expect(dumpDefinition(defineSymbol(consoleNodes[0], checker)!, checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 13,
            "fileName": "typescript/lib/lib.dom.d.ts",
            "kind": "VariableDeclaration",
            "line": 17177,
            "name": "console: Console",
            "path": "console",
          },
        ],
        "type": "Console",
      }
    `);

    const errorNodes = findIdentifiers(sourceFile, "Error");
    expect(dumpDefinition(defineSymbol(errorNodes[0], checker)!, checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 1,
            "fileName": "typescript/lib/lib.es5.d.ts",
            "kind": "InterfaceDeclaration",
            "line": 1027,
            "name": "interface Error {
      ",
            "path": "Error",
          },
          Object {
            "column": 13,
            "fileName": "typescript/lib/lib.es5.d.ts",
            "kind": "VariableDeclaration",
            "line": 1039,
            "name": "Error: ErrorConstructor",
            "path": "Error",
          },
        ],
        "type": "ErrorConstructor",
      }
    `);

    const promiseNodes = findIdentifiers(sourceFile, "Promise");
    expect(dumpDefinition(defineSymbol(promiseNodes[0], checker)!, checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 1,
            "fileName": "typescript/lib/lib.es5.d.ts",
            "kind": "InterfaceDeclaration",
            "line": 1501,
            "name": "interface Promise<T> {
      ",
            "path": "Promise",
          },
          Object {
            "column": 1,
            "fileName": "typescript/lib/lib.es2015.iterable.d.ts",
            "kind": "InterfaceDeclaration",
            "line": 218,
            "name": "interface Promise<T> { }",
            "path": "Promise",
          },
          Object {
            "column": 13,
            "fileName": "typescript/lib/lib.es2015.promise.d.ts",
            "kind": "VariableDeclaration",
            "line": 78,
            "name": "Promise: PromiseConstructor",
            "path": "Promise",
          },
          Object {
            "column": 1,
            "fileName": "typescript/lib/lib.es2015.symbol.wellknown.d.ts",
            "kind": "InterfaceDeclaration",
            "line": 173,
            "name": "interface Promise<T> {
      ",
            "path": "Promise",
          },
        ],
        "type": "PromiseConstructor",
      }
    `);
  });
});
