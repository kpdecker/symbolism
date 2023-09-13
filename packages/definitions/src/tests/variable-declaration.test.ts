import { dumpDefinition, dumpSymbol } from "@noom/symbolism-ts-debug";
import { findIdentifiers } from "@noom/symbolism-ts-utils";
import ts from "typescript";
import { mockProgram } from "../../test/utils";
import { defineSymbol } from "../index";

describe("infer variable declaration", () => {
  it("should pull variable declaration from explicit type", () => {
    const program = mockProgram({
      "test.ts": `
        type ExplicitType = { foo: string };
        const x: ExplicitType = { foo: undefined };
      `,
    });
    const checker = program.getTypeChecker();
    const varSymbol = checker
      .getSymbolsInScope(
        program.getSourceFile("test.ts")!,
        ts.SymbolFlags.Variable
      )
      .find((s) => s.getName() === "x");

    const type = defineSymbol(varSymbol?.valueDeclaration!, checker);
    expect(dumpDefinition(type, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "VariableDeclaration",
            "location": "test.ts:3:15",
            "name": "x: ExplicitType = { foo: undefined }",
            "path": "x",
          },
        ],
        "type": "ExplicitType",
      }
    `);

    expect(dumpSymbol(varSymbol!, checker)?.declaration).toMatchInlineSnapshot(`
      Array [
        Object {
          "kind": "VariableDeclaration",
          "location": "test.ts:3:15",
          "name": "x: ExplicitType = { foo: undefined }",
          "path": "x",
        },
      ]
    `);
  });
  it("should pull variable declaration from initializer", () => {
    const program = mockProgram({
      "test.ts": `
        const x = { foo: "foo" };
      `,
    });
    const checker = program.getTypeChecker();
    const varSymbol = checker
      .getSymbolsInScope(
        program.getSourceFile("test.ts")!,
        ts.SymbolFlags.Value
      )
      .find((s) => s.getName() === "x");

    const type = defineSymbol(varSymbol?.valueDeclaration!, checker);
    expect(dumpDefinition(type, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "VariableDeclaration",
            "location": "test.ts:2:15",
            "name": "x = { foo: \\"foo\\" }",
            "path": "x",
          },
        ],
        "type": "{ foo: string; }",
      }
    `);
  });

  it("should not use variable declaration for initializer", () => {
    const program = mockProgram({
      "test.ts": `
        const y = { foo: "foo" };
        const x = y;
      `,
    });
    const checker = program.getTypeChecker();
    const yNodes = findIdentifiers(program.getSourceFile("test.ts")!, "y");

    const type = defineSymbol(yNodes[1], checker);
    expect(dumpDefinition(type, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "VariableDeclaration",
            "location": "test.ts:2:15",
            "name": "y = { foo: \\"foo\\" }",
            "path": "y",
          },
        ],
        "type": "{ foo: string; }",
      }
    `);
  });
});
