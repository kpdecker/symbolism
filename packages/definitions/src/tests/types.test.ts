import { dumpDefinition } from "@noom/symbolism-ts-debug";
import { findIdentifiers, findNodesInTree } from "@noom/symbolism-ts-utils";
import ts from "typescript";
import { mockProgram } from "../../test/utils";
import { defineSymbol } from "../index";

const program = mockProgram({
  "test.tsx": `
    interface Foo { foo: string }
    interface Extend extends Foo { bat: string; }
    
    type IntersectionAlias = Foo & { bar: string };

    type Complicated = Extend | IntersectionAlias;

    function setExtras(extras?: {}) {
      return extras;
    }
  `,
});
const checker = program.getTypeChecker();
const sourceFile = program.getSourceFile("test.tsx")!;

function lookupNamedToken(name: string) {
  return findIdentifiers(sourceFile, name);
}

describe("types", () => {
  it("should resolve interface", () => {
    const nodes = lookupNamedToken("Foo");

    // Identity
    expect(dumpDefinition(defineSymbol(nodes[0].parent, checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "InterfaceDeclaration",
            "location": "test.tsx:2:5",
            "name": "interface Foo { foo: string }",
            "path": "Foo",
          },
        ],
        "type": "Foo",
      }
    `);

    // Extends
    expect(dumpDefinition(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "InterfaceDeclaration",
            "location": "test.tsx:2:5",
            "name": "interface Foo { foo: string }",
            "path": "Foo",
          },
        ],
        "type": "Foo",
      }
    `);

    // Intersection
    expect(dumpDefinition(defineSymbol(nodes[2], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "InterfaceDeclaration",
            "location": "test.tsx:2:5",
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
    expect(dumpDefinition(defineSymbol(nodes[0].parent, checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "InterfaceDeclaration",
            "location": "test.tsx:3:5",
            "name": "interface Extend extends Foo { bat: string; }",
            "path": "Extend",
          },
        ],
        "type": "Extend",
      }
    `);

    // Use
    expect(dumpDefinition(defineSymbol(nodes[1].parent, checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "InterfaceDeclaration",
            "location": "test.tsx:3:5",
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
    expect(dumpDefinition(defineSymbol(nodes[0].parent, checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "TypeAliasDeclaration",
            "location": "test.tsx:5:5",
            "name": "type IntersectionAlias = Foo & { bar: string };",
            "path": "IntersectionAlias",
          },
        ],
        "type": "IntersectionAlias",
      }
    `);

    expect(dumpDefinition(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "TypeAliasDeclaration",
            "location": "test.tsx:5:5",
            "name": "type IntersectionAlias = Foo & { bar: string };",
            "path": "IntersectionAlias",
          },
        ],
        "type": "IntersectionAlias",
      }
    `);
  });
  it("should handle type literal", () => {
    const nodes = findNodesInTree(sourceFile, ts.isTypeLiteralNode);

    expect(dumpDefinition(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "TypeLiteral",
            "location": "test.tsx:5:36",
            "name": "{ bar: string }",
            "path": "IntersectionAlias",
          },
        ],
        "type": "{ bar: string; }",
      }
    `);
  });

  it("should lookup object type literal", () => {
    const nodes = lookupNamedToken("extras");

    // Identity
    expect(dumpDefinition(defineSymbol(nodes[0].parent, checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "Parameter",
            "location": "test.tsx:9:24",
            "name": "extras?: {}",
            "path": "setExtras.extras",
          },
        ],
        "type": "{}",
      }
    `);

    // Extends
    expect(dumpDefinition(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "Parameter",
            "location": "test.tsx:9:24",
            "name": "extras?: {}",
            "path": "setExtras.extras",
          },
        ],
        "type": "{}",
      }
    `);
  });
});

// TODO: Multiple declarations w/ index
// Define Symbol! {
//   kind: 'Identifier',
//   name: 'gender',
//   path: '"@utils/redux/slices/surveyAnswers".SurveyAnswersState.[questionId]',
//   fileName: '/Users/kpdecker/dev/noom/buyflow-client/src/utils/enrollment.ts',
//   line: 21,
//   column: 44
// } gender
