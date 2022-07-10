import ts, { findAncestor } from "typescript";
import {
  dumpInferred,
  findNodeInTree,
  findNodesInTree,
  getPropertyValueType,
  mockProgram,
} from "../../../test/utils";
import { dumpNode, dumpSymbol } from "../../symbols";
import { defineSymbol } from "../index";

describe("infer functions", () => {
  it("should resolve function expression", () => {
    const program = mockProgram({
      "test.ts": `
        const foo = function() {}
        foo();
      `,
    });
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile("test.ts")!;

    const expressionNode = findNodeInTree(sourceFile, ts.isFunctionExpression)!;
    const expressionSymbol = defineSymbol(expressionNode, checker);
    expect(dumpInferred(expressionSymbol, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 14,
            "fileName": "test.ts",
            "kind": "VariableDeclaration",
            "line": 2,
            "name": "foo = function() {}",
            "path": "foo",
          },
        ],
        "type": "() => void",
      }
    `);

    const nodes = findNodesInTree(
      sourceFile,
      (node): node is ts.Identifier =>
        ts.isIdentifier(node) && node.getText() === "foo"
    );

    const reference = defineSymbol(nodes[0], checker);
    expect(dumpInferred(reference, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 14,
            "fileName": "test.ts",
            "kind": "VariableDeclaration",
            "line": 2,
            "name": "foo = function() {}",
            "path": "foo",
          },
        ],
        "type": "() => void",
      }
    `);
  });
  it("should handle yield", () => {
    const program = mockProgram({
      "test.ts": `
        const bar = {};
        const foo = function*() {
          yield bar;
        }
        foo();
      `,
    });
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile("test.ts")!;

    const node = findNodeInTree(sourceFile, ts.isYieldExpression)!;
    expect(dumpInferred(defineSymbol(node, checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [],
        "type": "any",
      }
    `);
  });
});
