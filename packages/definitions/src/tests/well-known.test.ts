import { dumpDefinition, dumpNode } from "@noom/symbolism-ts-debug";
import { findIdentifiers } from "@noom/symbolism-ts-utils";
import { mockProgram } from "../../test/utils";
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

describe("well known", () => {
  it("should handle Promise.then", () => {
    const nodes = findIdentifiers(sourceFile, "then");
    const definition = defineSymbol(nodes[0], checker);
    expect(dumpNode(nodes[0], checker)).toMatchInlineSnapshot(`
      Object {
        "kind": "Identifier",
        "location": "test.tsx:4:8",
        "name": "then",
        "path": "Promise.then",
      }
    `);
    expect(dumpDefinition(definition, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "MethodSignature",
            "location": "node_modules/typescript/lib/lib.es5.d.ts:1508:5",
            "name": "then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;",
            "path": "Promise.then",
          },
        ],
        "type": "<TResult1 = unknown, TResult2 = never>(onfulfilled?: (value: unknown) => TResult1 | PromiseLike<TResult1>, onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2>) => Promise<...>",
      }
    `);
  });
  it("should handle destructuring", () => {
    const nodes = findIdentifiers(sourceFile, "then");
    const definition = defineSymbol(nodes[1], checker);
    expect(dumpNode(nodes[1], checker)).toMatchInlineSnapshot(`
      Object {
        "kind": "Identifier",
        "location": "test.tsx:13:13",
        "name": "then",
        "path": "then",
      }
    `);
    expect(dumpDefinition(definition, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "MethodSignature",
            "location": "node_modules/typescript/lib/lib.es5.d.ts:1508:5",
            "name": "then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;",
            "path": "Promise.then",
          },
        ],
        "type": "<TResult1 = T, TResult2 = never>(onfulfilled?: (value: T) => TResult1 | PromiseLike<TResult1>, onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2>) => Promise<...>",
      }
    `);
  });

  it("should handle JSON.parse", () => {
    const nodes = findIdentifiers(sourceFile, "parse");

    expect(dumpNode(nodes[0], checker)).toMatchInlineSnapshot(`
      Object {
        "kind": "Identifier",
        "location": "test.tsx:8:10",
        "name": "parse",
        "path": "JSON.parse",
      }
    `);
    expect(dumpDefinition(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "MethodSignature",
            "location": "node_modules/typescript/lib/lib.es5.d.ts:1114:5",
            "name": "parse(text: string, reviver?: (this: any, key: string, value: any) => any): any;",
            "path": "JSON.parse",
          },
        ],
        "type": "(text: string, reviver?: (this: any, key: string, value: any) => any) => any",
      }
    `);

    expect(dumpNode(nodes[1], checker)).toMatchInlineSnapshot(`
      Object {
        "kind": "Identifier",
        "location": "test.tsx:11:15",
        "name": "parse",
        "path": "JSON.parse",
      }
    `);
    expect(dumpDefinition(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "MethodSignature",
            "location": "node_modules/typescript/lib/lib.es5.d.ts:1114:5",
            "name": "parse(text: string, reviver?: (this: any, key: string, value: any) => any): any;",
            "path": "JSON.parse",
          },
        ],
        "type": "(text: string, reviver?: (this: any, key: string, value: any) => any) => any",
      }
    `);
  });
});
