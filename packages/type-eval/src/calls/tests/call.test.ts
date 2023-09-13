import { mockProgram } from "@noom-symbolism/test";
import { CallContext } from "../../context";
import { parseSymbolTable } from "@noom-symbolism/symbol-table";
import { loadFunctionCalls } from "..";
import { printCalls } from "../../print/calls";
import ts from "typescript";

function testProgram(program: ts.Program) {
  const checker = program.getTypeChecker();
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
    checker,
    symbolTable,
  };
}

function testCall(source: string) {
  const program = mockProgram({
    "test.tsx": source,
  });
  const sourceFile = program.getSourceFile("test.tsx")!;

  return {
    ...testProgram(program),
    sourceFile,
  };
}

describe("call arguments lookup", () => {
  it("should handle local types with the same names", () => {
    const program = mockProgram({
      "test.tsx": `
        import i18n from "i18next";

        type Props = {
          test: number;
        };

        function foo(props: Props) {
          return i18n.t("bar", { foo: props.test });
        }

        foo(notAThing);
      `,
      "foo.tsx": `
        import i18n from "i18next";

      type Props = {
          foo: string;
        };
        function foo(props: Props) {
          return i18n.t("foo", { foo: props.foo });
        }

        foo(notAThing);
      `,
    });

    const { checker, symbolTable } = testProgram(program);

    const foo = symbolTable.lookup("TFunction", checker);
    const calls = loadFunctionCalls(
      foo[0],
      new CallContext(foo[0], symbolTable, checker, {})
    );
    expect(printCalls(calls)).toMatchInlineSnapshot(`
      "i18n.t(\\"bar\\", arg as { foo: number });
      i18n.t(\\"foo\\", arg as { foo: string });
      "
    `);
  });
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
      new CallContext(foo[0], symbolTable, checker, {})
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
      new CallContext(foo[0], symbolTable, checker, {})
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
      new CallContext(foo[0], symbolTable, checker, {})
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
    const { checker, symbolTable } = testCall(`
      declare function foo(a: any): number;

      bar().then((bat) => {
        foo("foo", bat);
      });
    `);

    const foo = symbolTable.lookup("foo", checker);
    const calls = loadFunctionCalls(
      foo[0],
      new CallContext(foo[0], symbolTable, checker, {})
    );
    expect(printCalls(calls)).toMatchInlineSnapshot(`
      "foo(\\"foo\\", arg as any);
      "
    `);
  });
  it("should handle being passed to a call", () => {
    const { checker, symbolTable } = testCall(`
      declare function passed(a: any): number;
      declare function foo(a: any): number;

      passed(foo);
    `);

    const foo = symbolTable.lookup("foo", checker);
    const calls = loadFunctionCalls(
      foo[0],
      new CallContext(foo[0], symbolTable, checker, {})
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
      new CallContext(foo[0], symbolTable, checker, {})
    );
    expect(printCalls(calls)).toMatchInlineSnapshot(`
      "i18n.t(\`namey:nameName:Anti-Sub\`, {});
      i18n.t(\`namey:nameName:McNameFace\`, {});
      "
    `);
  });

  it("should resolve derived primitives", () => {
    const { checker, symbolTable } = testCall(`
      import i18n from "i18next";

      declare const locale: string;

      function callWithReturn(date: Date): string {
        return date.toLocaleString(locale, { month: "long" });
      }

      const value = callWithReturn(notFound);
      const property = locale.toLowerCase();
      const noTrialCopy = i18n.t("t", {
        month: value,
        value,
        prop: property,
        property,
      });
    `);

    const foo = symbolTable.lookup("TFunction", checker);
    const calls = loadFunctionCalls(
      foo[0],
      new CallContext(foo[0], symbolTable, checker, {})
    );
    expect(printCalls(calls)).toMatchInlineSnapshot(`
      "i18n.t(
        \\"t\\",
        arg as {
          month: string;
          prop: string;
          property: string;
          value: string;
        }
      );
      "
    `);
  });

  it("should handle string templates", () => {
    const { checker, symbolTable } = testCall(`
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
      new CallContext(foo[0], symbolTable, checker, {})
    );
    expect(printCalls(calls)).toMatchInlineSnapshot(`
      "obj.foo(arg as \`foo:\${number}\`);
      "
    `);
  });

  describe("destructuring", () => {
    it("should handle destructuring in declaration", () => {
      const { checker, symbolTable } = testCall(`
        type Typey = {
          email: string;
        };

        declare function foo(a: any): number;

        function bar({ email }: Typey) {
          return foo(email + "bat");
        }

        declare const param: string;

        bar({ email: 'bar' });
        bar({ email: 'baz' });
        bar({ email: param });
      `);

      const foo = symbolTable.lookup("foo", checker);
      const calls = loadFunctionCalls(
        foo[0],
        new CallContext(foo[0], symbolTable, checker, {})
      );
      expect(printCalls(calls)).toMatchInlineSnapshot(`
        "foo(arg as \`\${string}bat\`);
        foo(\`barbat\`);
        foo(\`bazbat\`);
        "
      `);
    });

    it("should handle destructuring in block", () => {
      const { checker, symbolTable } = testCall(`
        type Typey = {
          email: string;
        };

        declare function foo(a: any): number;

        function bar(param: Typey) {
          const { email } = param;
          return foo(email + "bat");
        }

        declare const param: string;

        bar({ email: 'bar' });
        bar({ email: 'baz' });
        bar({ email: param });
      `);

      const foo = symbolTable.lookup("foo", checker);
      const calls = loadFunctionCalls(
        foo[0],
        new CallContext(foo[0], symbolTable, checker, {})
      );
      expect(printCalls(calls)).toMatchInlineSnapshot(`
        "foo(arg as \`\${string}bat\`);
        foo(\`barbat\`);
        foo(\`bazbat\`);
        "
      `);
    });
  });

  /**
   * Define symbol resolves shorthand properties to the object, not
   * the local value by default. This created infinite loops within
   * the call recursion.
   */
  it("should handle object literals with shorthand", () => {
    const { checker, symbolTable } = testCall(`
      declare const foo: (value) => void;

      function bat(data: {
        value: number;
        bat: number;
        nested: { bat: number };
      }) {
        foo(data);
      }

      function bar(value) {
        bat({
          value,
          bat: 1 + 9,
          nested: { bat: 1 + 9 }
        });
      }

      bar("foo");
      bar(true);
    `);

    const foo = symbolTable.lookup("foo", checker);

    const calls = loadFunctionCalls(
      foo[0],
      new CallContext(foo[0], symbolTable, checker, {})
    );
    expect(printCalls(calls)).toMatchInlineSnapshot(`
      "foo({
        bat: 10,
        nested: { bat: 10 },
        value: \\"foo\\",
      });
      foo({
        bat: 10,
        nested: { bat: 10 },
        value: true,
      });
      "
    `);
  });
  it("should only resolve calls in expressions", () => {
    const { checker, symbolTable } = testCall(`
      declare const foo: (value) => void;

      function bat(data) {
        foo(data);
      }

      function bar(value) {
        bat(value);
      }
      bar.baz = (val) => {};

      bar("foo");
      bar.baz(true);
    `);

    const foo = symbolTable.lookup("foo", checker);
    const calls = loadFunctionCalls(
      foo[0],
      new CallContext(foo[0], symbolTable, checker, {})
    );
    expect(printCalls(calls)).toMatchInlineSnapshot(`
      "foo(\\"foo\\");
      "
    `);
  });

  describe("index signatures", () => {
    it("should evaluate index keys", () => {
      const { checker, symbolTable } = testCall(`
        declare const injectedConfig: Record<string, string>;

        export const appConfig = {
          food: injectedConfig.food,
        } as const;

        declare function foo(value): void;

        foo(appConfig.bar);
        foo(appConfig.food);
      `);

      const foo = symbolTable.lookup("foo", checker);
      const calls = loadFunctionCalls(
        foo[0],
        new CallContext(foo[0], symbolTable, checker, {})
      );
      expect(printCalls(calls)).toMatchInlineSnapshot(`
        "foo(arg as string);
        foo(undefined);
        "
      `);
    });
    it("should evaluate index keys on literals", () => {
      const { checker, symbolTable } = testCall(`
        export const appConfig: Record<string, string> = {
          food: "bar",
        };

        declare function foo(value): void;

        foo(appConfig.bar);
        foo(appConfig);
        foo(appConfig.food);
      `);

      const foo = symbolTable.lookup("foo", checker);
      const calls = loadFunctionCalls(
        foo[0],
        new CallContext(foo[0], symbolTable, checker, {})
      );
      expect(printCalls(calls)).toMatchInlineSnapshot(`
        "foo(
          arg as {
            food: \\"bar\\";
            [k: string]: string;
          }
        );
        foo(arg as string);
        foo(\\"bar\\");
        "
      `);
    });
  });

  it("should evaluate derived values", () => {
    const { checker, symbolTable } = testCall(`
        declare function foo(value, note): void;

        declare const fullyBound: string;

        function bar({ boundParam, deepBoundParam }) {
          const { value: destructured } = deepBoundParam;
          foo(boundParam + 'bat', 'paramDestructure');
          foo(deepBoundParam.value, 'deepPropAccess');
          foo(deepBoundParam['value'], 'deepElementAccess');
          foo(destructured, 'destructured');
          foo(fullyBound, 'externalBound');
          foo(fullyBound.length, 'externalBoundProp');
          foo(fullyBound['length'], 'externalBoundPropElement');
        }

        bar({
          boundParam: 'bound!',
          deepBoundParam: {
            value: 'deep!'
          }
        })
      `);

    const foo = symbolTable.lookup("foo", checker);
    const calls = loadFunctionCalls(
      foo[0],
      new CallContext(foo[0], symbolTable, checker, {})
    );
    expect(printCalls(calls)).toMatchInlineSnapshot(`
      "foo(arg as number, \\"externalBoundProp\\");
      foo(arg as number, \\"externalBoundPropElement\\");
      foo(arg as string, \\"externalBound\\");
      foo(\`bound!bat\`, \\"paramDestructure\\");
      foo(\\"deep!\\", \\"deepElementAccess\\");
      foo(\\"deep!\\", \\"deepPropAccess\\");
      foo(\\"deep!\\", \\"destructured\\");
      "
    `);
  });
});
