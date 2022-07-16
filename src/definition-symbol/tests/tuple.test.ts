import invariant from "tiny-invariant";
import ts, { findAncestor } from "typescript";
import {
  dumpInferred,
  findNodeInTree,
  findNodesInTree,
  getPropertyValueType,
  mockProgram,
} from "../../../test/utils";
import { defineSymbol } from "../index";

const program = mockProgram({
  "test.tsx": `
    import { useState } from 'react';

    type ExplicitType = { foo: string };
    type Tuple = [string, ExplicitType, string, { bar: ExplicitType }];

    function destructure([paramA, paramB, paramC, { bar: paramD }]: Tuple): Tuple {
      return [paramA, paramB, paramC, { bar: paramD }];
    }

    const [
      destructureA,
      destructureB,
      destructureC,
      { bar: nestedDestructure }
    ] = destructure();

    const [ statey, setStatey ] = useState([ destructureA, destructureB, destructureC, nestedDestructure ]);
  `,
});
const checker = program.getTypeChecker();
const sourceFile = program.getSourceFile("test.tsx")!;

function lookupNamedToken(node: ts.Node, name: string) {
  return findNodesInTree(sourceFile, (node): node is ts.Identifier => {
    return ts.isIdentifier(node) && node.text === name;
  });
}

describe("infer tuple types", () => {
  it("should destructure tuple type", () => {
    const destructureANodes = lookupNamedToken(sourceFile, "destructureA");
    const destructureBNodes = lookupNamedToken(sourceFile, "destructureB");
    const destructureCNodes = lookupNamedToken(sourceFile, "destructureC");
    const nestedDestructureNodes = lookupNamedToken(
      sourceFile,
      "nestedDestructure"
    );

    expect(dumpInferred(defineSymbol(destructureANodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [],
        "type": "string",
      }
    `);
    expect(dumpInferred(defineSymbol(destructureANodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "BindingElement",
            "line": 12,
            "name": "destructureA",
            "path": "destructureA",
          },
        ],
        "type": "string",
      }
    `);

    expect(dumpInferred(defineSymbol(destructureBNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 24,
            "fileName": "test.tsx",
            "kind": "TypeLiteral",
            "line": 4,
            "name": "{ foo: string }",
            "path": "ExplicitType",
          },
        ],
        "type": "ExplicitType",
      }
    `);
    expect(dumpInferred(defineSymbol(destructureBNodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 24,
            "fileName": "test.tsx",
            "kind": "TypeLiteral",
            "line": 4,
            "name": "{ foo: string }",
            "path": "ExplicitType",
          },
        ],
        "type": "ExplicitType",
      }
    `);

    expect(dumpInferred(defineSymbol(destructureCNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [],
        "type": "string",
      }
    `);

    expect(
      dumpInferred(defineSymbol(nestedDestructureNodes[0], checker), checker)
    ).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 50,
            "fileName": "test.tsx",
            "kind": "PropertySignature",
            "line": 5,
            "name": "bar: ExplicitType",
            "path": "Tuple.bar",
          },
        ],
        "type": "ExplicitType",
      }
    `);
  });

  it("should destructure tuple in params", () => {
    const paramANodes = lookupNamedToken(sourceFile, "paramA");
    const paramBNodes = lookupNamedToken(sourceFile, "paramB");
    const paramCNodes = lookupNamedToken(sourceFile, "paramC");
    const paramDNodes = lookupNamedToken(sourceFile, "paramD");

    expect(dumpInferred(defineSymbol(paramANodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [],
        "type": "string",
      }
    `);
    expect(dumpInferred(defineSymbol(paramANodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 26,
            "fileName": "test.tsx",
            "kind": "BindingElement",
            "line": 7,
            "name": "paramA",
            "path": "destructure.paramA",
          },
        ],
        "type": "string",
      }
    `);

    expect(dumpInferred(defineSymbol(paramBNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 24,
            "fileName": "test.tsx",
            "kind": "TypeLiteral",
            "line": 4,
            "name": "{ foo: string }",
            "path": "ExplicitType",
          },
        ],
        "type": "ExplicitType",
      }
    `);
    expect(dumpInferred(defineSymbol(paramBNodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 24,
            "fileName": "test.tsx",
            "kind": "TypeLiteral",
            "line": 4,
            "name": "{ foo: string }",
            "path": "ExplicitType",
          },
        ],
        "type": "ExplicitType",
      }
    `);

    expect(dumpInferred(defineSymbol(paramCNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [],
        "type": "string",
      }
    `);

    expect(dumpInferred(defineSymbol(paramDNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 50,
            "fileName": "test.tsx",
            "kind": "PropertySignature",
            "line": 5,
            "name": "bar: ExplicitType",
            "path": "Tuple.bar",
          },
        ],
        "type": "ExplicitType",
      }
    `);
  });

  it("should handle hooks", () => {
    const stateyNodes = lookupNamedToken(sourceFile, "statey");
    const setStateyNodes = lookupNamedToken(sourceFile, "setStatey");

    expect(dumpInferred(defineSymbol(stateyNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 0,
            "fileName": "typescript/lib/lib.es5.d.ts",
            "kind": "InterfaceDeclaration",
            "line": 1275,
            "name": "interface Array<T> {
      ",
            "path": "Array",
          },
          Object {
            "column": 12,
            "fileName": "typescript/lib/lib.es5.d.ts",
            "kind": "VariableDeclaration",
            "line": 1470,
            "name": "Array: ArrayConstructor",
            "path": "Array",
          },
          Object {
            "column": 0,
            "fileName": "typescript/lib/lib.es2015.core.d.ts",
            "kind": "InterfaceDeclaration",
            "line": 21,
            "name": "interface Array<T> {
      ",
            "path": "Array",
          },
          Object {
            "column": 0,
            "fileName": "typescript/lib/lib.es2015.iterable.d.ts",
            "kind": "InterfaceDeclaration",
            "line": 58,
            "name": "interface Array<T> {
      ",
            "path": "Array",
          },
          Object {
            "column": 0,
            "fileName": "typescript/lib/lib.es2015.symbol.wellknown.d.ts",
            "kind": "InterfaceDeclaration",
            "line": 94,
            "name": "interface Array<T> {
      ",
            "path": "Array",
          },
          Object {
            "column": 0,
            "fileName": "typescript/lib/lib.es2016.array.include.d.ts",
            "kind": "InterfaceDeclaration",
            "line": 21,
            "name": "interface Array<T> {
      ",
            "path": "Array",
          },
        ],
        "type": "(string | ExplicitType)[]",
      }
    `);
    expect(dumpInferred(defineSymbol(setStateyNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 23,
            "fileName": "@types/react/index.d.ts",
            "kind": "FunctionType",
            "line": 859,
            "name": "(value: A) => void",
            "path": "React.Dispatch",
          },
        ],
        "type": "Dispatch<SetStateAction<(string | ExplicitType)[]>>",
      }
    `);
  });
});
