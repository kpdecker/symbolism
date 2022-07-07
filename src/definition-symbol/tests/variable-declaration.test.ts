import ts from 'typescript';
import {
  dumpInferred,
  getPropertyValueType,
  mockProgram,
} from '../../../test/utils';
import { dumpSymbol } from '../../symbols';
import { defineType } from '../index';

describe('infer variable declaration', () => {
  it('should pull variable declaration from explicit type', () => {
    const program = mockProgram({
      'test.ts': `
        type ExplicitType = { foo: string };
        const x: ExplicitType = { foo: undefined };
      `,
    });
    const checker = program.getTypeChecker();
    const varSymbol = checker
      .getSymbolsInScope(
        program.getSourceFile('test.ts')!,
        ts.SymbolFlags.Variable
      )
      .find((s) => s.getName() === 'x');

    const type = defineType(varSymbol?.valueDeclaration!, checker);
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

    expect(dumpSymbol(varSymbol!, checker)).toMatchInlineSnapshot(`
      Array [
        Object {
          "column": 14,
          "fileName": "test.ts",
          "kind": "VariableDeclaration",
          "line": 3,
          "name": "x: ExplicitType = { foo: undefined }",
          "path": ".x",
        },
      ]
    `);
  });
  it('should pull variable declaration from initializer', () => {
    const program = mockProgram({
      'test.ts': `
        const x = { foo: "foo" };
      `,
    });
    const checker = program.getTypeChecker();
    const varSymbol = checker
      .getSymbolsInScope(
        program.getSourceFile('test.ts')!,
        ts.SymbolFlags.Value
      )
      .find((s) => s.getName() === 'x');

    const type = defineType(varSymbol?.valueDeclaration!, checker);
    expect(dumpInferred(type, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 18,
            "fileName": "test.ts",
            "kind": "ObjectLiteralExpression",
            "line": 2,
            "name": "{ foo: \\"foo\\" }",
            "path": ".x",
          },
        ],
        "type": "{ foo: string; }",
      }
    `);
  });
});
