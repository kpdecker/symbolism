import { dumpDefinition } from "@noom-symbolism/ts-debug";
import { findNodeInTree } from "@noom-symbolism/ts-utils";
import ts from "typescript";
import { mockProgram } from "../../test/utils";
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
    expect(dumpDefinition(type, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "TypeLiteral",
            "location": "test.ts:2:29",
            "name": "{ foo: string }",
            "path": "ExplicitType",
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
    expect(dumpDefinition(type, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "ObjectLiteralExpression",
            "location": "test.ts:3:18",
            "name": "{ foo: \\"foo\\" }",
            "path": "x",
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
    expect(dumpDefinition(type, checker)).toMatchInlineSnapshot(`null`);
  });
});
