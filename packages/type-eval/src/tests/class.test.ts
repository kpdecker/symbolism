import { mockProgram } from "@noom-symbolism/test";
import { findIdentifiers, findNodesInTree } from "@noom-symbolism/ts-utils";
import { printSchema } from "../print/typescript";
import { SchemaContext } from "../context";
import ts from "typescript";
import { evaluateSchema } from "../schema";

function testType(source: string, name = "Type") {
  const program = mockProgram({
    "test.ts": source,
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile("test.ts")!;
  const node = findIdentifiers(sourceFile, name)[0];
  return {
    type: checker.getTypeAtLocation(node),
    declaration: node,
    program,
    sourceFile,
    checker,

    context: new SchemaContext(node, checker, {}),
  };
}

describe("type schema converter", () => {
  describe("classes", () => {
    it("should convert class schemas", () => {
      const { context, sourceFile } = testType(`
        interface Foo { foo: string }
        class DeclaredClass implements Foo {
          foo: string;
          propParent: string;

          methodDeclare(): string {
            return '';
          }

          #_length = 0;
          get length() {
            return this.#_length;
          }
          set length(value) {
            this.#_length = value;
          }
    
          static {
              try {
                  const inst = new DeclaredClass();
                  inst.#_length += inst.length;
              }
              catch {}
          }
        }

        const Expression = class extends DeclaredClass {
          propInit = 'foo';
          foo = 'bar';

          constructor(
            public readonly readonlyParameterProp: number,
            protected parameterProp: number
          ) {
            super()
          }

          override methodDeclare(): string {
            this.length = 20;
            return super.methodDeclare() + 'bar' +
                this.readonlyParameterProp +
                this.parameterProp +
                this.foo +
                this.propParent +
                this.propInit;
          }
        };

        function thisType(this: DeclaredClass) {
          return this.propParent;
        }

        new Expression(1, 2);
        new DeclaredClass();
      `);

      const newNodes = findNodesInTree(sourceFile, ts.isNewExpression);
      expect(printSchema(evaluateSchema(newNodes[0], context.checker)))
        .toMatchInlineSnapshot(`
        "{
          \\"#_length\\": number;
          foo: string;
          length: number;
          methodDeclare: () => string;
          propParent: string;
        };
        "
      `);

      expect(printSchema(evaluateSchema(newNodes[1], context.checker)))
        .toMatchInlineSnapshot(`
        "{
          \\"#_length\\": number;
          foo: string;
          length: number;
          methodDeclare: () => string;
          parameterProp: number;
          propInit: string;
          propParent: string;
          readonlyParameterProp: number;
        };
        "
      `);

      const thisNodes = findNodesInTree(
        sourceFile,
        (node): node is ts.Node => node.kind === ts.SyntaxKind.ThisKeyword
      );
      expect(printSchema(evaluateSchema(thisNodes[0], context.checker)))
        .toMatchInlineSnapshot(`
        "{
          \\"#_length\\": number;
          foo: string;
          length: number;
          methodDeclare: () => string;
          propParent: string;
        };
        "
      `);
      expect(printSchema(evaluateSchema(thisNodes[2], context.checker)))
        .toMatchInlineSnapshot(`
        "{
          \\"#_length\\": number;
          foo: string;
          length: number;
          methodDeclare: () => string;
          parameterProp: number;
          propInit: string;
          propParent: string;
          readonlyParameterProp: number;
        };
        "
      `);
      expect(
        printSchema(
          evaluateSchema(thisNodes[thisNodes.length - 1], context.checker)
        )
      ).toMatchInlineSnapshot(`
        "{
          \\"#_length\\": number;
          foo: string;
          length: number;
          methodDeclare: () => string;
          propParent: string;
        };
        "
      `);

      const superNodes = findNodesInTree(
        sourceFile,
        (node): node is ts.Node => node.kind === ts.SyntaxKind.SuperKeyword
      );
      expect(printSchema(evaluateSchema(superNodes[0], context.checker)))
        .toMatchInlineSnapshot(`
        "{
          prototype: {
            \\"__#1@#_length\\": number;
            foo: string;
            length: number;
            methodDeclare: () => string;
            propParent: string;
          };
        };
        "
      `);
    });
    it("should convert enums", () => {
      const { context, sourceFile } = testType(`
        enum Foo {
          a = 1,
          c = 3,
        }
      `);

      const fooNodes = findIdentifiers(sourceFile, "Foo");
      expect(printSchema(evaluateSchema(fooNodes[0], context.checker)))
        .toMatchInlineSnapshot(`
        "1 | 3;
        "
      `);

      const aNodes = findIdentifiers(sourceFile, "a");
      expect(printSchema(evaluateSchema(aNodes[0], context.checker)))
        .toMatchInlineSnapshot(`
        "1;
        "
      `);
    });
  });
});
