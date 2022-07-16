import invariant from "tiny-invariant";
import ts, { findAncestor } from "typescript";
import {
  dumpInferred,
  findNodeInTree,
  getPropertyValueType,
  mockProgram,
} from "../../../test/utils";
import { defineSymbol } from "../index";

describe("infer object literal types", () => {
  it("should pull object type from object type", () => {
    const program = mockProgram({
      "test.ts": `
        type ExplicitType = { foo: string };
        function x(foo: string, bar: ExplicitType) {}
        x(undefined, { foo: undefined });
      `,
    });
    const checker = program.getTypeChecker();
    const callStatement = findNodeInTree(
      program.getSourceFile("test.ts")!,
      ts.isCallExpression
    )!;

    const objectType = defineSymbol(callStatement.arguments[1], checker)!;
    expect(dumpInferred(objectType, checker)).toMatchInlineSnapshot(`
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
  it("should pull object type from variable type", () => {
    const program = mockProgram({
      "test.ts": `
        type ExplicitType = { foo: string };
        const x: ExplicitType = { foo: undefined });
      `,
    });
    const checker = program.getTypeChecker();
    const varSymbol = checker
      .getSymbolsInScope(
        program.getSourceFile("test.ts")!,
        ts.SymbolFlags.Value
      )
      .find((s) => s.getName() === "x");

    invariant(ts.isVariableDeclaration(varSymbol?.valueDeclaration!));

    const objectType = defineSymbol(
      varSymbol?.valueDeclaration?.initializer!,
      checker
    )!;
    expect(dumpInferred(objectType, checker)).toMatchInlineSnapshot(`
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
  it("should pull object type from array type", () => {
    const program = mockProgram({
      "test.ts": `
        type ExplicitType = { foo: string }[];
        const x: ExplicitType = [{ foo: undefined })];
      `,
    });
    const checker = program.getTypeChecker();
    const varSymbol = checker
      .getSymbolsInScope(
        program.getSourceFile("test.ts")!,
        ts.SymbolFlags.Value
      )
      .find((s) => s.getName() === "x");

    invariant(ts.isVariableDeclaration(varSymbol?.valueDeclaration!));
    const arrayNode = varSymbol?.valueDeclaration?.initializer!;
    const objectNode = findNodeInTree(arrayNode, ts.isObjectLiteralExpression)!;

    const arrayType = defineSymbol(arrayNode, checker)!;
    expect(dumpInferred(arrayType, checker)).toMatchInlineSnapshot(`
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
        "type": "{ foo: string; }",
      }
    `);

    const objectType = defineSymbol(objectNode, checker)!;
    expect(dumpInferred(objectType, checker)).toMatchInlineSnapshot(`
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
        "type": "{ foo: string; }",
      }
    `);
  });

  it("should pull array type from object type", () => {
    const program = mockProgram({
      "test.ts": `
        type ExplicitType = { foo: {bar: string}[] };
        const x: ExplicitType = { foo: undefined };
      `,
    });
    const checker = program.getTypeChecker();

    const varSymbol = checker
      .getSymbolsInScope(
        program.getSourceFile("test.ts")!,
        ts.SymbolFlags.Value
      )
      .find((s) => s.getName() === "x");
    invariant(ts.isVariableDeclaration(varSymbol?.valueDeclaration!));

    const objectNode = varSymbol?.valueDeclaration?.initializer!;
    invariant(ts.isObjectLiteralExpression(objectNode));

    const propertyNode = objectNode.properties[0];

    const objectType = defineSymbol(objectNode, checker)!;
    expect(dumpInferred(objectType, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 28,
            "fileName": "test.ts",
            "kind": "TypeLiteral",
            "line": 2,
            "name": "{ foo: {bar: string}[] }",
            "path": "ExplicitType",
          },
        ],
        "type": "ExplicitType",
      }
    `);

    const propertyType = defineSymbol(propertyNode, checker)!;
    expect(dumpInferred(propertyType, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 30,
            "fileName": "test.ts",
            "kind": "PropertySignature",
            "line": 2,
            "name": "foo: {bar: string}[]",
            "path": "ExplicitType.foo",
          },
        ],
        "type": "{ bar: string; }[]",
      }
    `);
  });
  it("should pull array type from deep object type", () => {
    const program = mockProgram({
      "test.ts": `
        type ExplicitType = { foo: {bar: string[]} };
        const x: ExplicitType = { foo: { bar: undefined } };
      `,
    });
    const checker = program.getTypeChecker();
    const varSymbol = checker
      .getSymbolsInScope(
        program.getSourceFile("test.ts")!,
        ts.SymbolFlags.Value
      )
      .find((s) => s.getName() === "x");

    invariant(ts.isVariableDeclaration(varSymbol?.valueDeclaration!));
    const objectNode = varSymbol?.valueDeclaration?.initializer!;
    const nestedObjectNode = findNodeInTree(
      objectNode,
      ts.isObjectLiteralExpression
    )!;
    const propertyNode = nestedObjectNode.properties[0];

    const nestedObjectType = defineSymbol(nestedObjectNode, checker)!;
    expect(dumpInferred(nestedObjectType, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 28,
            "fileName": "test.ts",
            "kind": "TypeLiteral",
            "line": 2,
            "name": "{ foo: {bar: string[]} }",
            "path": "ExplicitType",
          },
        ],
        "type": "ExplicitType",
      }
    `);

    const propertyType = defineSymbol(propertyNode, checker)!;
    expect(dumpInferred(propertyType, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 30,
            "fileName": "test.ts",
            "kind": "PropertySignature",
            "line": 2,
            "name": "foo: {bar: string[]}",
            "path": "ExplicitType.foo",
          },
        ],
        "type": "{ bar: string[]; }",
      }
    `);
  });

  it("should pull array binding from function arguments", () => {
    const program = mockProgram({
      "test.ts": `
        type ExplicitType = ({ foo: string })[];
        const x = (foo: ExplicitType): ExplicitType => [{ foo: undefined }];
        x([y]);
      `,
    });
    const checker = program.getTypeChecker();
    const yNode = findNodeInTree(
      program.getSourceFile("test.ts")!,
      (node): node is ts.Identifier =>
        ts.isIdentifier(node) && node.getText() === "y"
    );

    const inferred = defineSymbol(yNode!, checker);
    expect(dumpInferred(inferred, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 29,
            "fileName": "test.ts",
            "kind": "TypeLiteral",
            "line": 2,
            "name": "{ foo: string }",
            "path": "ExplicitType",
          },
        ],
        "type": "{ foo: string; }",
      }
    `);
  });

  it("should resolve computed property names", () => {
    const program = mockProgram({
      "test.ts": `
        const x: number[] = [ 1, ...console ];
      `,
    });
    const checker = program.getTypeChecker();
    const node = findNodeInTree(
      program.getSourceFile("test.ts")!,
      ts.isSpreadElement
    );

    const inferred = defineSymbol(node!, checker);
    expect(dumpInferred(inferred, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 12,
            "fileName": "typescript/lib/lib.dom.d.ts",
            "kind": "VariableDeclaration",
            "line": 17177,
            "name": "console: Console",
            "path": "console",
          },
        ],
        "type": "Console",
      }
    `);
  });

  // TODO: Nested arrays
  // TODO: Nested objects
  // TODO: Tuples
});
