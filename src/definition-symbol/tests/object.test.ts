import ts from "typescript";
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
  return findNodesInTree(sourceFile, (node): node is ts.Identifier => {
    return ts.isIdentifier(node) && node.text === name;
  });
}

describe("objects", () => {
  it("should handle method declaration", () => {
    const nodes = lookupNamedToken("methodDeclare");

    // Identity
    expect(dumpInferred(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "MethodDeclaration",
            "line": 3,
            "name": "methodDeclare() {}",
            "path": "untypedObject.methodDeclare",
          },
        ],
        "type": "() => void",
      }
    `);

    // Usage
    expect(dumpInferred(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "MethodDeclaration",
            "line": 3,
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
    expect(dumpInferred(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "GetAccessor",
            "line": 5,
            "name": "get getter() {}",
            "path": "untypedObject.getter",
          },
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "SetAccessor",
            "line": 6,
            "name": "set getter() {}",
            "path": "untypedObject.getter",
          },
        ],
        "type": "void",
      }
    `);

    // Setter
    expect(dumpInferred(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "GetAccessor",
            "line": 5,
            "name": "get getter() {}",
            "path": "untypedObject.getter",
          },
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "SetAccessor",
            "line": 6,
            "name": "set getter() {}",
            "path": "untypedObject.getter",
          },
        ],
        "type": "void",
      }
    `);

    // Access
    expect(dumpInferred(defineSymbol(nodes[2], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "GetAccessor",
            "line": 5,
            "name": "get getter() {}",
            "path": "untypedObject.getter",
          },
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "SetAccessor",
            "line": 6,
            "name": "set getter() {}",
            "path": "untypedObject.getter",
          },
        ],
        "type": "void",
      }
    `);

    // Assignment
    expect(dumpInferred(defineSymbol(nodes[3], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "GetAccessor",
            "line": 5,
            "name": "get getter() {}",
            "path": "untypedObject.getter",
          },
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "SetAccessor",
            "line": 6,
            "name": "set getter() {}",
            "path": "untypedObject.getter",
          },
        ],
        "type": "void",
      }
    `);
  });
});
