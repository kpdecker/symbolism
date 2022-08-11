import { mockProgram } from "@symbolism/test";
import { CallContext } from "../../context";
import { parseSymbolTable } from "@symbolism/symbol-table";
import { loadFunctionCalls } from "..";
import { printCalls } from "../../print/calls";

function testCall(source: string) {
  const program = mockProgram({
    "test.tsx": source,
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile("test.tsx")!;

  const symbolTable = parseSymbolTable(program, {
    exclude() {
      return false;
    },
    baseDir: ".",
    coverageJsonPath: "coverage.json",
    entryPoints: ["test.tsx"],
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
      new CallContext(foo[0], symbolTable, checker)
    );
    expect(printCalls(calls)).toMatchInlineSnapshot(`
      "foo(arg as number);
      foo(1);
      foo(1234);
      foo(2);
      foo(2468);
      foo(undefined);
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
      new CallContext(foo[0], symbolTable, checker)
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
      new CallContext(foo[0], symbolTable, checker)
    );
    expect(printCalls(calls)).toMatchInlineSnapshot(`
      "foo(arg as \`\${number} + 1244 * 10 + 10\`);
      foo(28400);
      foo(5678);
      foo(56790);
      foo(5688);
      foo(56890);
      "
    `);
  });

  it("should handle partially resolved calls in callbacks", () => {
    const { checker, symbolTable, sourceFile } = testCall(`
      declare function foo(a: any): number;

      bar().then((bat) => {
        foo("foo", bat);
      });
    `);

    const foo = symbolTable.lookup("foo", checker);
    const calls = loadFunctionCalls(
      foo[0],
      new CallContext(foo[0], symbolTable, checker)
    );
    expect(printCalls(calls)).toMatchInlineSnapshot(`
      "foo(\\"foo\\", arg as any);
      "
    `);
  });
  it("should handle being passed to a call", () => {
    const { checker, symbolTable, sourceFile } = testCall(`
      declare function passed(a: any): number;
      declare function foo(a: any): number;

      passed(foo);
    `);

    const foo = symbolTable.lookup("foo", checker);
    const calls = loadFunctionCalls(
      foo[0],
      new CallContext(foo[0], symbolTable, checker)
    );
    expect(printCalls(calls)).toMatchInlineSnapshot(`""`);
  });

  it("should resolve named arrows", () => {
    // TODO: const theNewOne = makeNamey;
    const { checker, symbolTable } = testCall(`
      import i18n from "i18next";
      const name = "namey";

      const makeNamey = (key: string, properties = {}) =>
        i18n.t(
          \`\${name}:nameName:\${key}\`,
          properties
        );

      makeNamey("McNameFace");
      makeNamey("Anti-Sub")
    `);

    const foo = symbolTable.lookup("TFunction", checker);
    const calls = loadFunctionCalls(
      foo[0],
      new CallContext(foo[0], symbolTable, checker)
    );
    expect(printCalls(calls)).toMatchInlineSnapshot(`
      "i18n.t(\`namey:nameName:Anti-Sub\`, {});
      i18n.t(\`namey:nameName:McNameFace\`, {});
      "
    `);
  });

  it("should handle string templates", () => {
    const { checker, symbolTable, sourceFile } = testCall(`
      declare const value: { bar: number };
      declare const obj: {foo: (a: any) => number};

      class Foo {
        bar: number;
        render() {
          return (
            <div>{obj.foo(\`foo:\${this.bar}\`)}</div>
          );
        }
      }
    `);

    const foo = symbolTable.lookup("foo", checker);
    const calls = loadFunctionCalls(
      foo[0],
      new CallContext(foo[0], symbolTable, checker)
    );
    expect(printCalls(calls)).toMatchInlineSnapshot(`
      "obj.foo(arg as \`foo:\${number}\`);
      "
    `);
  });
});
