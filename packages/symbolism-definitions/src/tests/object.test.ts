import { dumpDefinition } from "@symbolism/ts-debug";
import { findIdentifiers } from "@symbolism/ts-utils";
import { mockProgram } from "../../test/utils";
import { defineSymbol } from "../index";

const program = mockProgram({
  "test.tsx": `
    const untypedObject = {
      methodDeclare() {},

      get getter() {},
      set getter() {},
    };

    const spreadObject = {
      ...untypedObject,
    };

    // TODO: Typed lookup for method syntax

    untypedObject.methodDeclare();

    untypedObject.getter;
    spreadObject.getter = "";
  `,
});
const checker = program.getTypeChecker();
const sourceFile = program.getSourceFile("test.tsx")!;

function lookupNamedToken(name: string) {
  return findIdentifiers(sourceFile, name);
}

describe("objects", () => {
  it("should handle method declaration", () => {
    const nodes = lookupNamedToken("methodDeclare");

    // Identity
    expect(dumpDefinition(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "MethodDeclaration",
            "location": "test.tsx:3:7",
            "name": "methodDeclare() {}",
            "path": "untypedObject.methodDeclare",
          },
        ],
        "type": "() => void",
      }
    `);

    // Usage
    expect(dumpDefinition(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "MethodDeclaration",
            "location": "test.tsx:3:7",
            "name": "methodDeclare() {}",
            "path": "untypedObject.methodDeclare",
          },
        ],
        "type": "() => void",
      }
    `);
  });
  it("should handle getters and setters", () => {
    const nodes = lookupNamedToken("getter");

    // Getter
    expect(dumpDefinition(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "GetAccessor",
            "location": "test.tsx:5:7",
            "name": "get getter() {}",
            "path": "untypedObject.getter",
          },
          Object {
            "kind": "SetAccessor",
            "location": "test.tsx:6:7",
            "name": "set getter() {}",
            "path": "untypedObject.getter",
          },
        ],
        "type": "void",
      }
    `);

    // Setter
    expect(dumpDefinition(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "GetAccessor",
            "location": "test.tsx:5:7",
            "name": "get getter() {}",
            "path": "untypedObject.getter",
          },
          Object {
            "kind": "SetAccessor",
            "location": "test.tsx:6:7",
            "name": "set getter() {}",
            "path": "untypedObject.getter",
          },
        ],
        "type": "void",
      }
    `);

    // Access
    expect(dumpDefinition(defineSymbol(nodes[2], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "GetAccessor",
            "location": "test.tsx:5:7",
            "name": "get getter() {}",
            "path": "untypedObject.getter",
          },
          Object {
            "kind": "SetAccessor",
            "location": "test.tsx:6:7",
            "name": "set getter() {}",
            "path": "untypedObject.getter",
          },
        ],
        "type": "void",
      }
    `);

    // Assignment
    expect(dumpDefinition(defineSymbol(nodes[3], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "GetAccessor",
            "location": "test.tsx:5:7",
            "name": "get getter() {}",
            "path": "untypedObject.getter",
          },
          Object {
            "kind": "SetAccessor",
            "location": "test.tsx:6:7",
            "name": "set getter() {}",
            "path": "untypedObject.getter",
          },
        ],
        "type": "void",
      }
    `);
  });
});
