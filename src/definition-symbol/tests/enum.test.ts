import ts, { findAncestor } from "typescript";
import {
  dumpInferred,
  findNodesInTree,
  getPropertyValueType,
  mockProgram,
} from "../../../test/utils";
import { dumpNode, dumpSymbol } from "../../symbols";
import { defineSymbol } from "../index";

describe("infer enum", () => {
  it("should pull enum declaration", () => {
    const program = mockProgram({
      "test.ts": `
        enum MyEnum { foo };
        const x = MyEnum.foo;
        const y = MyEnum[MyEnum.foo];
      `,
    });
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile("test.ts")!;
    const nodes = findNodesInTree(
      sourceFile,
      (node): node is ts.Identifier =>
        ts.isIdentifier(node) && node.getText() === "foo"
    );

    const declarationNode = findAncestor(nodes[0], ts.isEnumDeclaration)!;
    const enumDeclaration = defineSymbol(declarationNode, checker);
    expect(dumpInferred(enumDeclaration, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 8,
            "fileName": "test.ts",
            "kind": "EnumDeclaration",
            "line": 2,
            "name": "enum MyEnum { foo }",
            "path": ".MyEnum",
          },
        ],
        "type": "typeof MyEnum",
      }
    `);

    const declarationMember = defineSymbol(nodes[0].parent, checker);
    expect(dumpInferred(declarationMember, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 22,
            "fileName": "test.ts",
            "kind": "EnumMember",
            "line": 2,
            "name": "foo",
            "path": ".MyEnum.foo",
          },
        ],
        "type": "MyEnum.foo",
      }
    `);

    const declarationIdentifier = defineSymbol(nodes[0], checker);
    expect(dumpInferred(declarationIdentifier, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 22,
            "fileName": "test.ts",
            "kind": "EnumMember",
            "line": 2,
            "name": "foo",
            "path": ".MyEnum.foo",
          },
        ],
        "type": "MyEnum.foo",
      }
    `);

    const reference = defineSymbol(nodes[1], checker);
    expect(dumpInferred(reference, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 22,
            "fileName": "test.ts",
            "kind": "EnumMember",
            "line": 2,
            "name": "foo",
            "path": ".MyEnum.foo",
          },
        ],
        "type": "MyEnum.foo",
      }
    `);

    const varSymbol = checker
      .getSymbolsInScope(
        program.getSourceFile("test.ts")!,
        ts.SymbolFlags.Variable
      )
      .filter((s) => ["x", "y"].includes(s.getName()));

    expect(
      dumpInferred(
        defineSymbol(varSymbol[0].valueDeclaration!, checker),
        checker
      )
    ).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 14,
            "fileName": "test.ts",
            "kind": "VariableDeclaration",
            "line": 3,
            "name": "x = MyEnum.foo",
            "path": ".x",
          },
        ],
        "type": "MyEnum.foo",
      }
    `);
    expect(
      dumpInferred(
        defineSymbol(varSymbol[1].valueDeclaration!, checker),
        checker
      )
    ).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 14,
            "fileName": "test.ts",
            "kind": "VariableDeclaration",
            "line": 4,
            "name": "y = MyEnum[MyEnum.foo]",
            "path": ".y",
          },
        ],
        "type": "string",
      }
    `);
  });
});
