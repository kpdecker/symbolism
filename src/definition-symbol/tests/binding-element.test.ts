import ts from 'typescript';
import {
  dumpInferred,
  findNodeInTree,
  getPropertyValueType,
  mockProgram,
} from '../../../test/utils';
import { dumpSymbol } from '../../symbols';
import { defineType } from '../index';

describe('infer binding elements', () => {
  describe('object literal', () => {
    it('should pull object binding from variable', () => {
      const program = mockProgram({
        'test.ts': `
        type ExplicitType = { foo: string };
        const x: ExplicitType = { foo: undefined };
        const { foo: y } = x;
      `,
      });
      const checker = program.getTypeChecker();
      const varSymbol = checker
        .getSymbolsInScope(
          program.getSourceFile('test.ts')!,
          ts.SymbolFlags.Variable
        )
        .find((s) => s.getName() === 'y');

      const type = defineType(varSymbol?.valueDeclaration!, checker);
      expect(dumpInferred(type, checker)).toMatchInlineSnapshot(`
              Object {
                "symbol": Array [
                  Object {
                    "column": 30,
                    "fileName": "test.ts",
                    "kind": "PropertySignature",
                    "line": 2,
                    "name": "foo: string",
                    "path": ".ExplicitType.foo",
                  },
                ],
                "type": "string",
              }
          `);
    });
    it('should pull object rest binding from variable', () => {
      const program = mockProgram({
        'test.ts': `
        type ExplicitType = { foo: string };
        const x: ExplicitType = { foo: undefined };
        const { foo, ...y } = x;
      `,
      });
      const checker = program.getTypeChecker();
      const varSymbol = checker
        .getSymbolsInScope(
          program.getSourceFile('test.ts')!,
          ts.SymbolFlags.Variable
        )
        .find((s) => s.getName() === 'y');

      const type = defineType(varSymbol?.valueDeclaration!, checker);
      expect(dumpInferred(type, checker)).toMatchInlineSnapshot(`
        Object {
          "symbol": Array [
            Object {
              "column": 21,
              "fileName": "test.ts",
              "kind": "BindingElement",
              "line": 4,
              "name": "...y",
              "path": ".{ foo, ...y }.BindingElement()",
            },
          ],
          "type": "{}",
        }
      `);
    });
    it('should pull object binding from function calls', () => {
      const program = mockProgram({
        'test.ts': `
        type ExplicitType = { foo: string };
        const x = (): ExplicitType => ({ foo: undefined });
        const { foo: y } = x();
      `,
      });
      const checker = program.getTypeChecker();
      const varSymbol = checker
        .getSymbolsInScope(
          program.getSourceFile('test.ts')!,
          ts.SymbolFlags.Variable
        )
        .find((s) => s.getName() === 'y');

      const type = defineType(varSymbol?.valueDeclaration!, checker);
      expect(dumpInferred(type, checker)).toMatchInlineSnapshot(`
              Object {
                "symbol": Array [
                  Object {
                    "column": 30,
                    "fileName": "test.ts",
                    "kind": "PropertySignature",
                    "line": 2,
                    "name": "foo: string",
                    "path": ".ExplicitType.foo",
                  },
                ],
                "type": "string",
              }
          `);
    });

    it('should pull original variable from assignment', () => {
      const program = mockProgram({
        'test.ts': `
        type ExplicitType = { foo: string };
        const x: ExplicitType = { foo: undefined };
        let y;
        ({y} = x);
      `,
      });
      const checker = program.getTypeChecker();
      const varSymbol = checker
        .getSymbolsInScope(
          program.getSourceFile('test.ts')!,
          ts.SymbolFlags.Variable
        )
        .find((s) => s.getName() === 'y');

      const inferred = defineType(varSymbol?.valueDeclaration!, checker);
      expect(dumpInferred(inferred, checker)).toMatchInlineSnapshot(`
        Object {
          "symbol": Array [
            Object {
              "column": 12,
              "fileName": "test.ts",
              "kind": "VariableDeclaration",
              "line": 4,
              "name": "y",
              "path": ".y",
            },
          ],
          "type": "any",
        }
      `);
    });
  });
  describe('array literals', () => {
    it('should pull array binding from variable', () => {
      const program = mockProgram({
        'test.ts': `
        type ExplicitType = ({ foo: string })[];
        const x: ExplicitType = [{ foo: undefined }];
        const [y] = x;
      `,
      });
      const checker = program.getTypeChecker();
      const varSymbol = checker
        .getSymbolsInScope(
          program.getSourceFile('test.ts')!,
          ts.SymbolFlags.Variable
        )
        .find((s) => s.getName() === 'y');

      const inferred = defineType(varSymbol?.valueDeclaration!, checker);
      expect(dumpInferred(inferred, checker)).toMatchInlineSnapshot(`
              Object {
                "symbol": Array [
                  Object {
                    "column": 29,
                    "fileName": "test.ts",
                    "kind": "TypeLiteral",
                    "line": 2,
                    "name": "{ foo: string }",
                    "path": ".ExplicitType.[]",
                  },
                ],
                "type": "{ foo: string; }",
              }
          `);
    });
    it('should pull array rest binding from variable', () => {
      const program = mockProgram({
        'test.ts': `
        type ExplicitType = ({ foo: string })[];
        const x: ExplicitType = [{ foo: undefined }];
        const [...y] = x;
      `,
      });
      const checker = program.getTypeChecker();
      const varSymbol = checker
        .getSymbolsInScope(
          program.getSourceFile('test.ts')!,
          ts.SymbolFlags.Variable
        )
        .find((s) => s.getName() === 'y');

      const inferred = defineType(varSymbol?.valueDeclaration!, checker);
      expect(dumpInferred(inferred, checker)).toMatchInlineSnapshot(`
              Object {
                "symbol": Array [
                  Object {
                    "column": 29,
                    "fileName": "test.ts",
                    "kind": "TypeLiteral",
                    "line": 2,
                    "name": "{ foo: string }",
                    "path": ".ExplicitType.[]",
                  },
                ],
                "type": "{ foo: string; }",
              }
          `);
    });
    it('should pull array binding from function calls', () => {
      const program = mockProgram({
        'test.ts': `
        type ExplicitType = ({ foo: string })[];
        const x = (): ExplicitType => [{ foo: undefined }];
        const [y] = x();
      `,
      });
      const checker = program.getTypeChecker();
      const varSymbol = checker
        .getSymbolsInScope(
          program.getSourceFile('test.ts')!,
          ts.SymbolFlags.Variable
        )
        .find((s) => s.getName() === 'y');

      const type = defineType(varSymbol?.valueDeclaration!, checker);
      expect(dumpInferred(type, checker)).toMatchInlineSnapshot(`
              Object {
                "symbol": Array [
                  Object {
                    "column": 29,
                    "fileName": "test.ts",
                    "kind": "TypeLiteral",
                    "line": 2,
                    "name": "{ foo: string }",
                    "path": ".ExplicitType.[]",
                  },
                ],
                "type": "{ foo: string; }",
              }
          `);
    });

    it('should pull original variable from assignment', () => {
      const program = mockProgram({
        'test.ts': `
        type ExplicitType = ({ foo: string })[];
        const x: ExplicitType = [{ foo: undefined }];
        let y;
        ([y] = x);
      `,
      });
      const checker = program.getTypeChecker();
      const varSymbol = checker
        .getSymbolsInScope(
          program.getSourceFile('test.ts')!,
          ts.SymbolFlags.Variable
        )
        .find((s) => s.getName() === 'y');

      const inferred = defineType(varSymbol?.valueDeclaration!, checker);
      expect(dumpInferred(inferred, checker)).toMatchInlineSnapshot(`
        Object {
          "symbol": Array [
            Object {
              "column": 12,
              "fileName": "test.ts",
              "kind": "VariableDeclaration",
              "line": 4,
              "name": "y",
              "path": ".y",
            },
          ],
          "type": "any",
        }
      `);
    });
  });

  // TODO: Tuple?
});
