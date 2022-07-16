import ts from "typescript";
import {
  dumpInferred,
  findNodeInTree,
  findNodesInTree,
  getPropertyValueType,
  mockProgram,
} from "../../../test/utils";
import { dumpNode } from "../../symbols";
import { defineSymbol } from "../index";

const program = mockProgram({
  "test.tsx": `
    const promise = new Promise((resolve, reject) => {
    })
      .then(() => {
        return Promise.resolve(1);
      });

    JSON.parse(JSON.stringify({foo: 'bar'}));

    const otherJSON = JSON;
    otherJSON.parse(JSON.stringify({foo: 'bar'}));

    const { then } = Promise.prototype;
  `,
});
const checker = program.getTypeChecker();
const sourceFile = program.getSourceFile("test.tsx")!;

function lookupNamedToken(node: ts.Node, name: string) {
  return findNodesInTree(node, (node): node is ts.Identifier => {
    return ts.isIdentifier(node) && node.getText() === name;
  });
}

describe("well known", () => {
  it("should handle Promise.then", () => {
    const nodes = lookupNamedToken(sourceFile, "then");
    const definition = defineSymbol(nodes[0], checker);
    expect(dumpNode(nodes[0], checker)).toMatchInlineSnapshot(`
      Object {
        "column": 7,
        "fileName": "test.tsx",
        "kind": "Identifier",
        "line": 4,
        "name": "then",
        "path": "Promise.then",
      }
    `);
    expect(dumpInferred(definition, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 4,
            "fileName": "typescript/lib/lib.es5.d.ts",
            "kind": "MethodSignature",
            "line": 1508,
            "name": "then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;",
            "path": "Promise.then",
          },
        ],
        "type": "<TResult1 = unknown, TResult2 = never>(onfulfilled?: (value: unknown) => TResult1 | PromiseLike<TResult1>, onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2>) => Promise<...>",
      }
    `);
  });
  it("should handle destructuring", () => {
    const nodes = lookupNamedToken(sourceFile, "then");
    const definition = defineSymbol(nodes[1], checker);
    expect(dumpNode(nodes[1], checker)).toMatchInlineSnapshot(`
      Object {
        "column": 12,
        "fileName": "test.tsx",
        "kind": "Identifier",
        "line": 13,
        "name": "then",
        "path": "then",
      }
    `);
    expect(dumpInferred(definition, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 4,
            "fileName": "typescript/lib/lib.es5.d.ts",
            "kind": "MethodSignature",
            "line": 1508,
            "name": "then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;",
            "path": "Promise.then",
          },
        ],
        "type": "<TResult1 = T, TResult2 = never>(onfulfilled?: (value: T) => TResult1 | PromiseLike<TResult1>, onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2>) => Promise<...>",
      }
    `);
  });

  it("should handle JSON.parse", () => {
    const nodes = lookupNamedToken(sourceFile, "parse");

    expect(dumpNode(nodes[0], checker)).toMatchInlineSnapshot(`
      Object {
        "column": 9,
        "fileName": "test.tsx",
        "kind": "Identifier",
        "line": 8,
        "name": "parse",
        "path": "JSON.parse",
      }
    `);
    expect(dumpInferred(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 4,
            "fileName": "typescript/lib/lib.es5.d.ts",
            "kind": "MethodSignature",
            "line": 1114,
            "name": "parse(text: string, reviver?: (this: any, key: string, value: any) => any): any;",
            "path": "JSON.parse",
          },
        ],
        "type": "(text: string, reviver?: (this: any, key: string, value: any) => any) => any",
      }
    `);

    expect(dumpNode(nodes[1], checker)).toMatchInlineSnapshot(`
      Object {
        "column": 14,
        "fileName": "test.tsx",
        "kind": "Identifier",
        "line": 11,
        "name": "parse",
        "path": "JSON.parse",
      }
    `);
    expect(dumpInferred(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 4,
            "fileName": "typescript/lib/lib.es5.d.ts",
            "kind": "MethodSignature",
            "line": 1114,
            "name": "parse(text: string, reviver?: (this: any, key: string, value: any) => any): any;",
            "path": "JSON.parse",
          },
        ],
        "type": "(text: string, reviver?: (this: any, key: string, value: any) => any) => any",
      }
    `);
  });
});
