import ts, { findAncestor } from "typescript";
import {
  dumpInferred,
  findNodeInTree,
  getPropertyValueType,
  mockProgram,
} from "../../../test/utils";
import { defineSymbol } from "../index";

describe("infer call parameter type", () => {
  it("should pull parameter type from explicit type", () => {
    const program = mockProgram({
      "test.ts": `
        type ExplicitType = { foo: string };
        type ExplicitFn = (foo: string, bar: ExplicitType) => void;
        const x: ExplicitFn = function(foo, bar) {}
        x(undefined, undefined);
      `,
    });
    const checker = program.getTypeChecker();
    const callStatement = findNodeInTree(
      program.getSourceFile("test.ts")!,
      ts.isCallExpression
    )!;

    const stringArgument = defineSymbol(callStatement.arguments[0], checker)!;
    expect(dumpInferred(stringArgument, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 1,
            "fileName": "intrinsic",
            "kind": "keyword",
            "line": 1,
            "name": "undefined",
            "path": "undefined",
          },
        ],
        "type": "undefined",
      }
    `);

    const objectArgument = defineSymbol(callStatement.arguments[1], checker)!;
    expect(dumpInferred(objectArgument, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 28,
            "fileName": "test.ts",
            "kind": "TypeLiteral",
            "line": 2,
            "name": "{ foo: string }",
            "path": "ExplicitType",
          },
        ],
        "type": "ExplicitType",
      }
    `);
  });
  it("should pull parameter type from parameter type", () => {
    const program = mockProgram({
      "test.ts": `
        type ExplicitType = { foo: string };
        function x(foo: string, bar: ExplicitType) {}
        x(undefined, undefined);
      `,
    });
    const checker = program.getTypeChecker();
    const callStatement = findNodeInTree(
      program.getSourceFile("test.ts")!,
      ts.isCallExpression
    )!;

    const stringArgument = defineSymbol(callStatement.arguments[0], checker)!;
    expect(dumpInferred(stringArgument, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 1,
            "fileName": "intrinsic",
            "kind": "keyword",
            "line": 1,
            "name": "undefined",
            "path": "undefined",
          },
        ],
        "type": "undefined",
      }
    `);

    const objectArgument = defineSymbol(callStatement.arguments[1], checker)!;
    expect(dumpInferred(objectArgument, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 28,
            "fileName": "test.ts",
            "kind": "TypeLiteral",
            "line": 2,
            "name": "{ foo: string }",
            "path": "ExplicitType",
          },
        ],
        "type": "ExplicitType",
      }
    `);
  });
});
