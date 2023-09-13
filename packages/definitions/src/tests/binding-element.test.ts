import { dumpDefinition } from "@noom/symbolism-ts-debug";
import ts from "typescript";
import { mockProgram } from "../../test/utils";
import { defineSymbol } from "../index";

describe("infer binding elements", () => {
  describe("object literal", () => {
    it("should pull object binding from variable", () => {
      const program = mockProgram({
        "test.ts": `
        type ExplicitType = { foo: string };
        const x: ExplicitType = { foo: undefined };
        const { foo: y } = x;
      `,
      });
      const checker = program.getTypeChecker();
      const varSymbol = checker
        .getSymbolsInScope(
          program.getSourceFile("test.ts")!,
          ts.SymbolFlags.Variable
        )
        .find((s) => s.getName() === "y");

      const type = defineSymbol(varSymbol?.valueDeclaration!, checker);
      expect(dumpDefinition(type, checker)).toMatchInlineSnapshot(`
        Object {
          "symbol": Array [
            Object {
              "kind": "PropertySignature",
              "location": "test.ts:2:31",
              "name": "foo: string",
              "path": "ExplicitType.foo",
            },
          ],
          "type": "string",
        }
      `);
    });
    it("should pull object rest binding from variable", () => {
      const program = mockProgram({
        "test.ts": `
        type ExplicitType = { foo: string };
        const x: ExplicitType = { foo: undefined };
        const { foo, ...y } = x;
      `,
      });
      const checker = program.getTypeChecker();
      const varSymbol = checker
        .getSymbolsInScope(
          program.getSourceFile("test.ts")!,
          ts.SymbolFlags.Variable
        )
        .find((s) => s.getName() === "y");

      const type = defineSymbol(varSymbol?.valueDeclaration!, checker);
      expect(dumpDefinition(type, checker)).toMatchInlineSnapshot(`
        Object {
          "symbol": Array [
            Object {
              "kind": "BindingElement",
              "location": "test.ts:4:22",
              "name": "...y",
              "path": "y",
            },
          ],
          "type": "{}",
        }
      `);
    });
    it("should pull object binding from function calls", () => {
      const program = mockProgram({
        "test.ts": `
        type ExplicitType = { foo: string };
        const x = (): ExplicitType => ({ foo: undefined });
        const { foo: y } = x();
      `,
      });
      const checker = program.getTypeChecker();
      const varSymbol = checker
        .getSymbolsInScope(
          program.getSourceFile("test.ts")!,
          ts.SymbolFlags.Variable
        )
        .find((s) => s.getName() === "y");

      const type = defineSymbol(varSymbol?.valueDeclaration!, checker);
      expect(dumpDefinition(type, checker)).toMatchInlineSnapshot(`
        Object {
          "symbol": Array [
            Object {
              "kind": "PropertySignature",
              "location": "test.ts:2:31",
              "name": "foo: string",
              "path": "ExplicitType.foo",
            },
          ],
          "type": "string",
        }
      `);
    });

    it("should pull original variable from assignment", () => {
      const program = mockProgram({
        "test.ts": `
        type ExplicitType = { foo: string };
        const x: ExplicitType = { foo: undefined };
        let y;
        ({y} = x);
      `,
      });
      const checker = program.getTypeChecker();
      const varSymbol = checker
        .getSymbolsInScope(
          program.getSourceFile("test.ts")!,
          ts.SymbolFlags.Variable
        )
        .find((s) => s.getName() === "y");

      const inferred = defineSymbol(varSymbol?.valueDeclaration!, checker);
      expect(dumpDefinition(inferred, checker)).toMatchInlineSnapshot(`
        Object {
          "symbol": Array [
            Object {
              "kind": "VariableDeclaration",
              "location": "test.ts:4:13",
              "name": "y",
              "path": "y",
            },
          ],
          "type": "any",
        }
      `);
    });
  });
  describe("array literals", () => {
    it("should pull array binding from variable", () => {
      const program = mockProgram({
        "test.ts": `
        type ExplicitType = ({ foo: string })[];
        const x: ExplicitType = [{ foo: undefined }];
        const [y] = x;
      `,
      });
      const checker = program.getTypeChecker();
      const varSymbol = checker
        .getSymbolsInScope(
          program.getSourceFile("test.ts")!,
          ts.SymbolFlags.Variable
        )
        .find((s) => s.getName() === "y");

      const inferred = defineSymbol(varSymbol?.valueDeclaration!, checker);
      expect(dumpDefinition(inferred, checker)).toMatchInlineSnapshot(`
        Object {
          "symbol": Array [
            Object {
              "kind": "TypeLiteral",
              "location": "test.ts:2:30",
              "name": "{ foo: string }",
              "path": "ExplicitType",
            },
          ],
          "type": "{ foo: string; }",
        }
      `);
    });
    it("should pull array rest binding from variable", () => {
      const program = mockProgram({
        "test.ts": `
        type ExplicitType = ({ foo: string })[];
        const x: ExplicitType = [{ foo: undefined }];
        const [...y] = x;
      `,
      });
      const checker = program.getTypeChecker();
      const varSymbol = checker
        .getSymbolsInScope(
          program.getSourceFile("test.ts")!,
          ts.SymbolFlags.Variable
        )
        .find((s) => s.getName() === "y");

      const inferred = defineSymbol(varSymbol?.valueDeclaration!, checker);
      expect(dumpDefinition(inferred, checker)).toMatchInlineSnapshot(`
        Object {
          "symbol": Array [
            Object {
              "kind": "TypeLiteral",
              "location": "test.ts:2:30",
              "name": "{ foo: string }",
              "path": "ExplicitType",
            },
          ],
          "type": "{ foo: string; }",
        }
      `);
    });
    it("should pull array binding from function calls", () => {
      const program = mockProgram({
        "test.ts": `
        type ExplicitType = ({ foo: string })[];
        const x = (): ExplicitType => [{ foo: undefined }];
        const [y] = x();
      `,
      });
      const checker = program.getTypeChecker();
      const varSymbol = checker
        .getSymbolsInScope(
          program.getSourceFile("test.ts")!,
          ts.SymbolFlags.Variable
        )
        .find((s) => s.getName() === "y");

      const type = defineSymbol(varSymbol?.valueDeclaration!, checker);
      expect(dumpDefinition(type, checker)).toMatchInlineSnapshot(`
        Object {
          "symbol": Array [
            Object {
              "kind": "TypeLiteral",
              "location": "test.ts:2:30",
              "name": "{ foo: string }",
              "path": "ExplicitType",
            },
          ],
          "type": "{ foo: string; }",
        }
      `);
    });

    it("should pull original variable from assignment", () => {
      const program = mockProgram({
        "test.ts": `
        type ExplicitType = ({ foo: string })[];
        const x: ExplicitType = [{ foo: undefined }];
        let y;
        ([y] = x);
      `,
      });
      const checker = program.getTypeChecker();
      const varSymbol = checker
        .getSymbolsInScope(
          program.getSourceFile("test.ts")!,
          ts.SymbolFlags.Variable
        )
        .find((s) => s.getName() === "y");

      const inferred = defineSymbol(varSymbol?.valueDeclaration!, checker);
      expect(dumpDefinition(inferred, checker)).toMatchInlineSnapshot(`
        Object {
          "symbol": Array [
            Object {
              "kind": "VariableDeclaration",
              "location": "test.ts:4:13",
              "name": "y",
              "path": "y",
            },
          ],
          "type": "any",
        }
      `);
    });
  });

  // TODO: Tuple?
});
