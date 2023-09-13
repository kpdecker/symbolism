import { dumpDefinition } from "@noom-symbolism/ts-debug";
import { findIdentifiers } from "@noom-symbolism/ts-utils";
import ts, { findAncestor } from "typescript";
import { mockProgram } from "../../test/utils";
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
    const nodes = findIdentifiers(sourceFile, "foo");

    const declarationNode = findAncestor(nodes[0], ts.isEnumDeclaration)!;
    const enumDeclaration = defineSymbol(declarationNode, checker);
    expect(dumpDefinition(enumDeclaration, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "EnumDeclaration",
            "location": "test.ts:2:9",
            "name": "enum MyEnum { foo }",
            "path": "MyEnum",
          },
        ],
        "type": "typeof MyEnum",
      }
    `);

    const declarationMember = defineSymbol(nodes[0].parent, checker);
    expect(dumpDefinition(declarationMember, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "EnumMember",
            "location": "test.ts:2:23",
            "name": "foo",
            "path": "MyEnum.foo",
          },
        ],
        "type": "MyEnum.foo",
      }
    `);

    const declarationIdentifier = defineSymbol(nodes[0], checker);
    expect(dumpDefinition(declarationIdentifier, checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "EnumMember",
            "location": "test.ts:2:23",
            "name": "foo",
            "path": "MyEnum.foo",
          },
        ],
        "type": "MyEnum.foo",
      }
    `);

    const reference = defineSymbol(nodes[1], checker);
    expect(dumpDefinition(reference, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "EnumMember",
            "location": "test.ts:2:23",
            "name": "foo",
            "path": "MyEnum.foo",
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
      dumpDefinition(
        defineSymbol(varSymbol[0].valueDeclaration!, checker),
        checker
      )
    ).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "VariableDeclaration",
            "location": "test.ts:3:15",
            "name": "x = MyEnum.foo",
            "path": "x",
          },
        ],
        "type": "MyEnum.foo",
      }
    `);
    expect(
      dumpDefinition(
        defineSymbol(varSymbol[1].valueDeclaration!, checker),
        checker
      )
    ).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "VariableDeclaration",
            "location": "test.ts:4:15",
            "name": "y = MyEnum[MyEnum.foo]",
            "path": "y",
          },
        ],
        "type": "string",
      }
    `);
  });
});
