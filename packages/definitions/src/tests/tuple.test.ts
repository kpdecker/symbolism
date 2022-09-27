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
        "symbol": Array [
          Object {
            "kind": "BindingElement",
            "location": "test.tsx:12:7",
            "name": "destructureA",
            "path": "destructureA",
          },
        ],
        "type": "string",
      }
    `);
    expect(dumpDefinition(defineSymbol(destructureANodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "BindingElement",
            "location": "test.tsx:12:7",
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
            "kind": "TypeLiteral",
            "location": "test.tsx:4:25",
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
            "kind": "TypeLiteral",
            "location": "test.tsx:4:25",
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
        "symbol": Array [
          Object {
            "kind": "BindingElement",
            "location": "test.tsx:14:7",
            "name": "destructureC",
            "path": "destructureC",
          },
        ],
        "type": "string",
      }
    `);

    expect(
      dumpDefinition(defineSymbol(nestedDestructureNodes[0], checker), checker)
    ).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "PropertySignature",
            "location": "test.tsx:5:51",
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
        "symbol": Array [
          Object {
            "kind": "BindingElement",
            "location": "test.tsx:7:27",
            "name": "paramA",
            "path": "destructure.paramA",
          },
        ],
        "type": "string",
      }
    `);
    expect(dumpDefinition(defineSymbol(paramANodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "BindingElement",
            "location": "test.tsx:7:27",
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
            "kind": "TypeLiteral",
            "location": "test.tsx:4:25",
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
            "kind": "TypeLiteral",
            "location": "test.tsx:4:25",
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
        "symbol": Array [
          Object {
            "kind": "BindingElement",
            "location": "test.tsx:7:43",
            "name": "paramC",
            "path": "destructure.paramC",
          },
        ],
        "type": "string",
      }
    `);

    expect(dumpDefinition(defineSymbol(paramDNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "PropertySignature",
            "location": "test.tsx:5:51",
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
            "kind": "InterfaceDeclaration",
            "location": "node_modules/typescript/lib/lib.es5.d.ts:1275:1",
            "name": "interface Array<T> {
      ",
            "path": "Array",
          },
          Object {
            "kind": "VariableDeclaration",
            "location": "node_modules/typescript/lib/lib.es5.d.ts:1470:13",
            "name": "Array: ArrayConstructor",
            "path": "Array",
          },
          Object {
            "kind": "InterfaceDeclaration",
            "location": "node_modules/typescript/lib/lib.es2015.core.d.ts:21:1",
            "name": "interface Array<T> {
      ",
            "path": "Array",
          },
          Object {
            "kind": "InterfaceDeclaration",
            "location": "node_modules/typescript/lib/lib.es2015.iterable.d.ts:58:1",
            "name": "interface Array<T> {
      ",
            "path": "Array",
          },
          Object {
            "kind": "InterfaceDeclaration",
            "location": "node_modules/typescript/lib/lib.es2015.symbol.wellknown.d.ts:94:1",
            "name": "interface Array<T> {
      ",
            "path": "Array",
          },
          Object {
            "kind": "InterfaceDeclaration",
            "location": "node_modules/typescript/lib/lib.es2016.array.include.d.ts:21:1",
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
            "kind": "FunctionType",
            "location": "node_modules/@types/react/index.d.ts:859:24",
            "name": "(value: A) => void",
            "path": "React.Dispatch",
          },
        ],
        "type": "Dispatch<SetStateAction<(string | ExplicitType)[]>>",
      }
    `);
  });
});
