import { dumpDefinition } from "@symbolism/ts-debug";
import { findIdentifiers } from "@symbolism/ts-utils";
import { mockProgram } from "../../test/utils";
import { defineSymbol } from "../index";

const program = mockProgram({
  "source.ts": `
    export const stringValue = "foo";
    export function functionValue(): string {
    }

    export default functionValue();
  `,
  "test.tsx": `
    import { stringValue, functionValue } from "source";
    import * as Source from "source";

    import def from "source";

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
        "type": "() => string",
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
        "type": "() => string",
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
        "type": "() => string",
      }
    `);
  });

  it("should resolve named imports", () => {
    const defNodes = lookupNamedToken("def");

    expect(dumpDefinition(defineSymbol(defNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "ExportAssignment",
            "location": "source.ts:6:5",
            "name": "export default functionValue();",
            "path": "",
          },
        ],
        "type": "string",
      }
    `);
  });
});
