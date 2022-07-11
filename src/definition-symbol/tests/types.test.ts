import ts from "typescript";
import {
  dumpInferred,
  findNodeInTree,
  findNodesInTree,
  getPropertyValueType,
  mockProgram,
} from "../../../test/utils";
import { dumpNode, dumpSymbol } from "../../symbols";
import { defineSymbol } from "../index";

const program = mockProgram({
  "test.tsx": `
    interface Foo { foo: string }
    interface Extend extends Foo { bat: string; }
    
    type IntersectionAlias = Foo & { bar: string };

    type Complicated = Extend | IntersectionAlias;
  `,
});
const checker = program.getTypeChecker();
const sourceFile = program.getSourceFile("test.tsx")!;

function lookupNamedToken(name: string) {
  return findNodesInTree(sourceFile, (node): node is ts.Identifier => {
    return ts.isIdentifier(node) && node.text === name;
  });
}

describe("types", () => {
  it("should resolve interface", () => {
    const nodes = lookupNamedToken("Foo");

    // Identity
    expect(dumpInferred(defineSymbol(nodes[0].parent, checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 4,
            "fileName": "test.tsx",
            "kind": "InterfaceDeclaration",
            "line": 2,
            "name": "interface Foo { foo: string }",
            "path": "Foo",
          },
        ],
        "type": "Foo",
      }
    `);

    // Extends
    expect(dumpInferred(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 4,
            "fileName": "test.tsx",
            "kind": "InterfaceDeclaration",
            "line": 2,
            "name": "interface Foo { foo: string }",
            "path": "Foo",
          },
        ],
        "type": "Foo",
      }
    `);

    // Intersection
    expect(dumpInferred(defineSymbol(nodes[2], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 4,
            "fileName": "test.tsx",
            "kind": "InterfaceDeclaration",
            "line": 2,
            "name": "interface Foo { foo: string }",
            "path": "Foo",
          },
        ],
        "type": "Foo",
      }
    `);
  });
  it("should resolve extended interface", () => {
    const nodes = lookupNamedToken("Extend");

    // Identity
    expect(dumpInferred(defineSymbol(nodes[0].parent, checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 4,
            "fileName": "test.tsx",
            "kind": "InterfaceDeclaration",
            "line": 3,
            "name": "interface Extend extends Foo { bat: string; }",
            "path": "Extend",
          },
        ],
        "type": "Extend",
      }
    `);

    // Use
    expect(dumpInferred(defineSymbol(nodes[1].parent, checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 4,
            "fileName": "test.tsx",
            "kind": "InterfaceDeclaration",
            "line": 3,
            "name": "interface Extend extends Foo { bat: string; }",
            "path": "Extend",
          },
        ],
        "type": "Extend",
      }
    `);
  });
  it("should resolve intersection alias", () => {
    const nodes = lookupNamedToken("IntersectionAlias");

    // Use
    expect(dumpInferred(defineSymbol(nodes[0].parent, checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 4,
            "fileName": "test.tsx",
            "kind": "TypeAliasDeclaration",
            "line": 5,
            "name": "type IntersectionAlias = Foo & { bar: string };",
            "path": "IntersectionAlias",
          },
        ],
        "type": "IntersectionAlias",
      }
    `);

    expect(dumpInferred(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 4,
            "fileName": "test.tsx",
            "kind": "TypeAliasDeclaration",
            "line": 5,
            "name": "type IntersectionAlias = Foo & { bar: string };",
            "path": "IntersectionAlias",
          },
        ],
        "type": "IntersectionAlias",
      }
    `);
  });
  it.only("should handle type literal", () => {
    const nodes = findNodesInTree(sourceFile, ts.isTypeLiteralNode);

    expect(dumpInferred(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 35,
            "fileName": "test.tsx",
            "kind": "TypeLiteral",
            "line": 5,
            "name": "{ bar: string }",
            "path": "IntersectionAlias",
          },
        ],
        "type": "{ bar: string; }",
      }
    `);
  });
});
