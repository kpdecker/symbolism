import {
  dumpInferred,
  findIdentifiers,
  mockProgram,
} from "../../../test/utils";
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

    expect(dumpInferred(defineSymbol(stringValueNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 18,
            "fileName": "source.ts",
            "kind": "VariableDeclaration",
            "line": 2,
            "name": "stringValue = \\"foo\\"",
            "path": "stringValue",
          },
        ],
        "type": "\\"foo\\"",
      }
    `);
    expect(dumpInferred(defineSymbol(stringValueNodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 18,
            "fileName": "source.ts",
            "kind": "VariableDeclaration",
            "line": 2,
            "name": "stringValue = \\"foo\\"",
            "path": "stringValue",
          },
        ],
        "type": "\\"foo\\"",
      }
    `);

    // In object literal
    expect(dumpInferred(defineSymbol(stringValueNodes[2], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 18,
            "fileName": "source.ts",
            "kind": "VariableDeclaration",
            "line": 2,
            "name": "stringValue = \\"foo\\"",
            "path": "stringValue",
          },
        ],
        "type": "\\"foo\\"",
      }
    `);

    expect(dumpInferred(defineSymbol(functionValueNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 5,
            "fileName": "source.ts",
            "kind": "FunctionDeclaration",
            "line": 3,
            "name": "functionValue",
            "path": "functionValue",
          },
        ],
        "type": "() => void",
      }
    `);
    expect(dumpInferred(defineSymbol(functionValueNodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 5,
            "fileName": "source.ts",
            "kind": "FunctionDeclaration",
            "line": 3,
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

    expect(dumpInferred(defineSymbol(stringValueNodes[2], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 18,
            "fileName": "source.ts",
            "kind": "VariableDeclaration",
            "line": 2,
            "name": "stringValue = \\"foo\\"",
            "path": "stringValue",
          },
        ],
        "type": "\\"foo\\"",
      }
    `);

    expect(dumpInferred(defineSymbol(functionValueNodes[2], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 5,
            "fileName": "source.ts",
            "kind": "FunctionDeclaration",
            "line": 3,
            "name": "functionValue",
            "path": "functionValue",
          },
        ],
        "type": "() => void",
      }
    `);
  });
});
