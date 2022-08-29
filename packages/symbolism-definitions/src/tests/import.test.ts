import { dumpDefinition } from "@symbolism/ts-debug";
import { findIdentifiers } from "@symbolism/ts-utils";
import { mockProgram } from "../../test/utils";
import { defineSymbol } from "../index";

const program = mockProgram({
  "source.ts": `
    export const stringValue = "foo";
    export function functionValue() {
    }
  `,
  "test.tsx": `
    import { stringValue, functionValue } from "source";
    import * as Source from "source";

    stringValue;
    functionValue;
    Source.stringValue;
    Source.functionValue;

    test({
      foo: stringValue
    });

    function test(properties: any = {}) {}
  `,
});
const checker = program.getTypeChecker();
const sourceFile = program.getSourceFile("test.tsx")!;

function lookupNamedToken(name: string) {
  return findIdentifiers(sourceFile, name);
}

describe("imports", () => {
  it("should resolve named imports", () => {
    const stringValueNodes = lookupNamedToken("stringValue");
    const functionValueNodes = lookupNamedToken("functionValue");

    expect(dumpDefinition(defineSymbol(stringValueNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "VariableDeclaration",
            "location": "source.ts:2:18",
            "name": "stringValue = \\"foo\\"",
            "path": "stringValue",
          },
        ],
        "type": "\\"foo\\"",
      }
    `);
    expect(dumpDefinition(defineSymbol(stringValueNodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "VariableDeclaration",
            "location": "source.ts:2:18",
            "name": "stringValue = \\"foo\\"",
            "path": "stringValue",
          },
        ],
        "type": "\\"foo\\"",
      }
    `);

    // In object literal
    expect(dumpDefinition(defineSymbol(stringValueNodes[2], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "VariableDeclaration",
            "location": "source.ts:2:18",
            "name": "stringValue = \\"foo\\"",
            "path": "stringValue",
          },
        ],
        "type": "\\"foo\\"",
      }
    `);

    expect(
      dumpDefinition(defineSymbol(functionValueNodes[0], checker), checker)
    ).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "FunctionDeclaration",
            "location": "source.ts:3:5",
            "name": "functionValue",
            "path": "functionValue",
          },
        ],
        "type": "() => void",
      }
    `);
    expect(
      dumpDefinition(defineSymbol(functionValueNodes[1], checker), checker)
    ).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "FunctionDeclaration",
            "location": "source.ts:3:5",
            "name": "functionValue",
            "path": "functionValue",
          },
        ],
        "type": "() => void",
      }
    `);
  });
  it("should resolve namespace import", () => {
    const stringValueNodes = lookupNamedToken("stringValue");
    const functionValueNodes = lookupNamedToken("functionValue");

    expect(dumpDefinition(defineSymbol(stringValueNodes[2], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "VariableDeclaration",
            "location": "source.ts:2:18",
            "name": "stringValue = \\"foo\\"",
            "path": "stringValue",
          },
        ],
        "type": "\\"foo\\"",
      }
    `);

    expect(
      dumpDefinition(defineSymbol(functionValueNodes[2], checker), checker)
    ).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "FunctionDeclaration",
            "location": "source.ts:3:5",
            "name": "functionValue",
            "path": "functionValue",
          },
        ],
        "type": "() => void",
      }
    `);
  });
});
