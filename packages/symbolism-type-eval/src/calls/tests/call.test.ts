import { mockProgram } from "@symbolism/test";
import { getSymbolDeclaration } from "@symbolism/ts-utils";
import { SchemaContext } from "../../schema";
import { parseSymbolTable } from "@symbolism/symbol-table";
import { loadFunctionCalls } from "..";
import { printCalls } from "../../print/calls";

function testCall(source: string) {
  const program = mockProgram({
    "test.ts": source,
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile("test.ts")!;

  const symbolTable = parseSymbolTable(program, {
    exclude() {
      return false;
    },
    baseDir: ".",
    coverageJsonPath: "coverage.json",
    entryPoints: ["test.ts"],
    tokens: [],
    tsConfigPath: "tsconfig.json",
  });

  return {
    program,
    sourceFile,
    checker,
    symbolTable,
  };
}

describe("call arguments lookup", () => {
  it("should load direct calls", () => {
    const { checker, symbolTable } = testCall(`
      declare function foo(a: number): number;

      foo(1);
      foo(2);
      foo(undefined);

      const number = 1234
      foo(number);
      foo(1234 + number);

      declare const primitive: number;
      foo(primitive);
    `);

    const foo = symbolTable.lookup("foo", checker);
    const calls = loadFunctionCalls(
      foo[0],
      symbolTable,
      new SchemaContext(getSymbolDeclaration(foo[0])!, checker)
    );
    expect(printCalls(calls)).toMatchInlineSnapshot(`
      "foo(1);
      foo(2);
      foo(undefined);
      foo(1234);
      foo(2468);
      foo(number);
      "
    `);
  });
  it("should handle incorrect types", () => {
    const { checker, symbolTable } = testCall(`
      declare function foo(a: number): number;

      foo({
        bar: true,
        bat: 1 + 9
      });
    `);

    const foo = symbolTable.lookup("foo", checker);
    const calls = loadFunctionCalls(
      foo[0],
      symbolTable,
      new SchemaContext(getSymbolDeclaration(foo[0])!, checker)
    );
    expect(printCalls(calls)).toMatchInlineSnapshot(`
      "foo({
        bar: true,
        bat: 10,
      });
      "
    `);
  });
  it("should walk call hierarchy", () => {
    const { checker, symbolTable } = testCall(`
      declare function foo(a: number): number;

      function bar(a: number): number {
        return foo(a + 10);
      }

      function withExpression(a: number): number {
        return bar(a * 10);
      }

      function withVariable(a: number): number {
        const b = a + 10;
        return withExpression(b);
      }
      function withMultiple(a: number): number {
        const b = a + 10;
        return withExpression(b) + withExpression(a / 2);
      }

      function withClosure(a: number): number {
        const b = a + 10;
        return (c: number) => withExpression(c + b);
      }

      foo(5678);
      bar(5678);
      withExpression(5678);
      withVariable(5678);
      withMultiple(5678);
      withClosure(1234)(5678);
    `);

    const foo = symbolTable.lookup("foo", checker);
    const calls = loadFunctionCalls(
      foo[0],
      symbolTable,
      new SchemaContext(getSymbolDeclaration(foo[0])!, checker)
    );
    expect(printCalls(calls)).toMatchInlineSnapshot(`
      "foo(56890);
      foo(28400);
      foo((number + 1244) * 10 + 10);
      foo(56790);
      foo(5688);
      foo(5678);
      "
    `);
  });
});
