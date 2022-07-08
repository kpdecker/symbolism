import ts from "typescript";
import { dumpInferred, findNodeInTree, mockProgram } from "../../../test/utils";
import { defineSymbol } from "../index";

describe("infer return type", () => {
  it("should pull return type from explicit type", () => {
    const program = mockProgram({
      "test.ts": `
        type ExplicitType = { foo: string };
        function x(): ExplicitType {
          return { foo: undefined };
        }
      `,
    });
    const checker = program.getTypeChecker();
    const returnStatement = findNodeInTree(
      program.getSourceFile("test.ts")!,
      ts.isReturnStatement
    );
    const type = defineSymbol(returnStatement!, checker)!;
    expect(dumpInferred(type, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 28,
            "fileName": "test.ts",
            "kind": "TypeLiteral",
            "line": 2,
            "name": "{ foo: string }",
            "path": ".ExplicitType",
          },
        ],
        "type": "ExplicitType",
      }
    `);
  });
  it("should pull return type from inferred type", () => {
    const program = mockProgram({
      "test.ts": `
        function x() {
          return { foo: "foo" };
        }
      `,
    });
    const checker = program.getTypeChecker();
    const returnStatement = findNodeInTree(
      program.getSourceFile("test.ts")!,
      ts.isReturnStatement
    );
    const type = defineSymbol(returnStatement!, checker)!;
    expect(dumpInferred(type, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 17,
            "fileName": "test.ts",
            "kind": "ObjectLiteralExpression",
            "line": 3,
            "name": "{ foo: \\"foo\\" }",
            "path": ".x",
          },
        ],
        "type": "{ foo: string; }",
      }
    `);
  });
  it("should pull return type from inferred type", () => {
    const program = mockProgram({
      "test.ts": `
        function x() {
          return;
        }
      `,
    });
    const checker = program.getTypeChecker();
    const returnStatement = findNodeInTree(
      program.getSourceFile("test.ts")!,
      ts.isReturnStatement
    );
    const type = defineSymbol(returnStatement!, checker)!;
    expect(dumpInferred(type, checker)).toMatchInlineSnapshot(`null`);
  });
});
