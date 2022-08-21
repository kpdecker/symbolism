import { dumpDefinition } from "@symbolism/ts-debug";
import { findIdentifiers } from "@symbolism/ts-utils";
import { mockProgram } from "../../test/utils";
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

describe("infer tuple types", () => {
  it("should destructure tuple type", () => {
    const destructureANodes = findIdentifiers(sourceFile, "destructureA");
    const destructureBNodes = findIdentifiers(sourceFile, "destructureB");
    const destructureCNodes = findIdentifiers(sourceFile, "destructureC");
    const nestedDestructureNodes = findIdentifiers(
      sourceFile,
      "nestedDestructure"
    );

    expect(dumpDefinition(defineSymbol(destructureANodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": undefined,
        "type": "string",
      }
    `);
    expect(dumpDefinition(defineSymbol(destructureANodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 7,
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

    expect(dumpDefinition(defineSymbol(destructureBNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 25,
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
    expect(dumpDefinition(defineSymbol(destructureBNodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 25,
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

    expect(dumpDefinition(defineSymbol(destructureCNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": undefined,
        "type": "string",
      }
    `);

    expect(
      dumpDefinition(defineSymbol(nestedDestructureNodes[0], checker), checker)
    ).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 51,
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
    const paramANodes = findIdentifiers(sourceFile, "paramA");
    const paramBNodes = findIdentifiers(sourceFile, "paramB");
    const paramCNodes = findIdentifiers(sourceFile, "paramC");
    const paramDNodes = findIdentifiers(sourceFile, "paramD");

    expect(dumpDefinition(defineSymbol(paramANodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": undefined,
        "type": "string",
      }
    `);
    expect(dumpDefinition(defineSymbol(paramANodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 27,
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

    expect(dumpDefinition(defineSymbol(paramBNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 25,
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
    expect(dumpDefinition(defineSymbol(paramBNodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 25,
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

    expect(dumpDefinition(defineSymbol(paramCNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": undefined,
        "type": "string",
      }
    `);

    expect(dumpDefinition(defineSymbol(paramDNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 51,
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
    const stateyNodes = findIdentifiers(sourceFile, "statey");
    const setStateyNodes = findIdentifiers(sourceFile, "setStatey");

    expect(dumpDefinition(defineSymbol(stateyNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 1,
            "fileName": "typescript/lib/lib.es5.d.ts",
            "kind": "InterfaceDeclaration",
            "line": 1275,
            "name": "interface Array<T> {
      ",
            "path": "Array",
          },
          Object {
            "column": 13,
            "fileName": "typescript/lib/lib.es5.d.ts",
            "kind": "VariableDeclaration",
            "line": 1470,
            "name": "Array: ArrayConstructor",
            "path": "Array",
          },
          Object {
            "column": 1,
            "fileName": "typescript/lib/lib.es2015.core.d.ts",
            "kind": "InterfaceDeclaration",
            "line": 21,
            "name": "interface Array<T> {
      ",
            "path": "Array",
          },
          Object {
            "column": 1,
            "fileName": "typescript/lib/lib.es2015.iterable.d.ts",
            "kind": "InterfaceDeclaration",
            "line": 58,
            "name": "interface Array<T> {
      ",
            "path": "Array",
          },
          Object {
            "column": 1,
            "fileName": "typescript/lib/lib.es2015.symbol.wellknown.d.ts",
            "kind": "InterfaceDeclaration",
            "line": 94,
            "name": "interface Array<T> {
      ",
            "path": "Array",
          },
          Object {
            "column": 1,
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
    expect(dumpDefinition(defineSymbol(setStateyNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 24,
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
