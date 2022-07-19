import ts from "typescript";
import {
  dumpInferred,
  getPropertyValueType,
  mockProgram,
} from "../../../test/utils";
import { dumpSymbol } from "../../symbols";
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
    expect(dumpInferred(type, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 15,
            "fileName": "test.ts",
            "kind": "VariableDeclaration",
            "line": 3,
            "name": "x: ExplicitType = { foo: undefined }",
            "path": "x",
          },
        ],
        "type": "ExplicitType",
      }
    `);

    expect(dumpSymbol(varSymbol!, checker).declaration).toMatchInlineSnapshot(`
      Array [
        Object {
          "column": 15,
          "fileName": "test.ts",
          "kind": "VariableDeclaration",
          "line": 3,
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
    expect(dumpInferred(type, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 15,
            "fileName": "test.ts",
            "kind": "VariableDeclaration",
            "line": 2,
            "name": "x = { foo: \\"foo\\" }",
            "path": "x",
          },
        ],
        "type": "{ foo: string; }",
      }
    `);
  });
});
