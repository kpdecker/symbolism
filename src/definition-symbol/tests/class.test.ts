import ts from "typescript";
import {
  dumpInferred,
  findNodeInTree,
  findNodesInTree,
  getPropertyValueType,
  mockProgram,
} from "../../../test/utils";
import { dumpSymbol } from "../../symbols";
import { defineSymbol } from "../index";

const program = mockProgram({
  "test.tsx": `
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

    new Expression(1, 2);
    new DeclaredClass();
  `,
});
// TODO:
// declare resident: Dog;
const checker = program.getTypeChecker();
const sourceFile = program.getSourceFile("test.tsx")!;

function lookupNamedToken(name: string) {
  return findNodesInTree(sourceFile, (node): node is ts.Identifier => {
    return ts.isIdentifier(node) && node.text === name;
  });
}

describe("classes", () => {
  it("should resolve declared class", () => {
    const nodes = lookupNamedToken("DeclaredClass");

    // Identity
    expect(dumpInferred(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 4,
            "fileName": "test.tsx",
            "kind": "ClassDeclaration",
            "line": 3,
            "name": "class DeclaredClass implements Foo {",
            "path": ".DeclaredClass",
          },
        ],
        "type": "DeclaredClass",
      }
    `);

    // Instantiate
    expect(dumpInferred(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 4,
            "fileName": "test.tsx",
            "kind": "ClassDeclaration",
            "line": 3,
            "name": "class DeclaredClass implements Foo {",
            "path": ".DeclaredClass",
          },
        ],
        "type": "typeof DeclaredClass",
      }
    `);

    // Extends
    expect(dumpInferred(defineSymbol(nodes[2], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 4,
            "fileName": "test.tsx",
            "kind": "ClassDeclaration",
            "line": 3,
            "name": "class DeclaredClass implements Foo {",
            "path": ".DeclaredClass",
          },
        ],
        "type": "typeof DeclaredClass",
      }
    `);
  });
  it("should resolve class expression", () => {
    const nodes = lookupNamedToken("Expression");

    // Identity
    expect(dumpInferred(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 10,
            "fileName": "test.tsx",
            "kind": "VariableDeclaration",
            "line": 28,
            "name": "Expression = class extends DeclaredClass {",
            "path": ".Expression",
          },
        ],
        "type": "typeof Expression",
      }
    `);

    // Use
    expect(dumpInferred(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 10,
            "fileName": "test.tsx",
            "kind": "VariableDeclaration",
            "line": 28,
            "name": "Expression = class extends DeclaredClass {",
            "path": ".Expression",
          },
        ],
        "type": "typeof Expression",
      }
    `);
  });
  it("should resolve implements", () => {
    const nodes = lookupNamedToken("Foo");

    // TODO: Type resolution
    expect(dumpInferred(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 4,
            "fileName": "test.tsx",
            "kind": "InterfaceDeclaration",
            "line": 2,
            "name": "interface Foo { foo: string }",
            "path": ".Foo",
          },
        ],
        "type": "any",
      }
    `);
  });

  it("should resolve interface properties", () => {
    const nodes = lookupNamedToken("foo");

    // Identity
    expect(dumpInferred(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 20,
            "fileName": "test.tsx",
            "kind": "PropertySignature",
            "line": 2,
            "name": "foo: string",
            "path": ".Foo.foo",
          },
        ],
        "type": "string",
      }
    `);

    // Implementation
    expect(dumpInferred(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 20,
            "fileName": "test.tsx",
            "kind": "PropertySignature",
            "line": 2,
            "name": "foo: string",
            "path": ".Foo.foo",
          },
        ],
        "type": "string",
      }
    `);

    //  Extends Definition
    expect(dumpInferred(defineSymbol(nodes[2], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 20,
            "fileName": "test.tsx",
            "kind": "PropertySignature",
            "line": 2,
            "name": "foo: string",
            "path": ".Foo.foo",
          },
        ],
        "type": "string",
      }
    `);

    // Reference
    expect(dumpInferred(defineSymbol(nodes[3], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 20,
            "fileName": "test.tsx",
            "kind": "PropertySignature",
            "line": 2,
            "name": "foo: string",
            "path": ".Foo.foo",
          },
        ],
        "type": "string",
      }
    `);
  });
  it("should resolve getter and setter", () => {
    const nodes = lookupNamedToken("length");

    // Getter
    expect(dumpInferred(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "GetAccessor",
            "line": 12,
            "name": "get length() {",
            "path": ".DeclaredClass.GetAccessor()",
          },
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "SetAccessor",
            "line": 15,
            "name": "set length(value) {",
            "path": ".DeclaredClass.SetAccessor()",
          },
        ],
        "type": "number",
      }
    `);

    // Setter
    expect(dumpInferred(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "GetAccessor",
            "line": 12,
            "name": "get length() {",
            "path": ".DeclaredClass.GetAccessor()",
          },
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "SetAccessor",
            "line": 15,
            "name": "set length(value) {",
            "path": ".DeclaredClass.SetAccessor()",
          },
        ],
        "type": "number",
      }
    `);

    //  Read
    expect(dumpInferred(defineSymbol(nodes[2], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "GetAccessor",
            "line": 12,
            "name": "get length() {",
            "path": ".DeclaredClass.GetAccessor()",
          },
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "SetAccessor",
            "line": 15,
            "name": "set length(value) {",
            "path": ".DeclaredClass.SetAccessor()",
          },
        ],
        "type": "number",
      }
    `);

    // Assign
    expect(dumpInferred(defineSymbol(nodes[3], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "GetAccessor",
            "line": 12,
            "name": "get length() {",
            "path": ".DeclaredClass.GetAccessor()",
          },
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "SetAccessor",
            "line": 15,
            "name": "set length(value) {",
            "path": ".DeclaredClass.SetAccessor()",
          },
        ],
        "type": "number",
      }
    `);
  });
  it("should handle constructors", () => {
    const constructorNodes = findNodesInTree(
      sourceFile,
      ts.isConstructorDeclaration
    );
    expect(dumpInferred(defineSymbol(constructorNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 23,
            "fileName": "test.tsx",
            "kind": "ClassExpression",
            "line": 28,
            "name": "class extends DeclaredClass {",
            "path": ".Expression",
          },
        ],
        "type": "typeof Expression",
      }
    `);

    const superNodes = findNodesInTree(
      sourceFile,
      (node): node is ts.SuperExpression =>
        node.kind === ts.SyntaxKind.SuperKeyword
    );
    expect(dumpInferred(defineSymbol(superNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 4,
            "fileName": "test.tsx",
            "kind": "ClassDeclaration",
            "line": 3,
            "name": "class DeclaredClass implements Foo {",
            "path": ".DeclaredClass",
          },
        ],
        "type": "typeof DeclaredClass",
      }
    `);
    expect(dumpInferred(defineSymbol(superNodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 4,
            "fileName": "test.tsx",
            "kind": "ClassDeclaration",
            "line": 3,
            "name": "class DeclaredClass implements Foo {",
            "path": ".DeclaredClass",
          },
        ],
        "type": "typeof DeclaredClass",
      }
    `);
  });

  it("should resolve method declarations", () => {
    const nodes = lookupNamedToken("methodDeclare");

    // Identity
    expect(dumpInferred(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "MethodDeclaration",
            "line": 7,
            "name": "methodDeclare(): string {",
            "path": ".DeclaredClass.methodDeclare",
          },
        ],
        "type": "() => string",
      }
    `);

    // Override
    expect(dumpInferred(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "MethodDeclaration",
            "line": 7,
            "name": "methodDeclare(): string {",
            "path": ".DeclaredClass.methodDeclare",
          },
        ],
        "type": "() => string",
      }
    `);
    expect(dumpInferred(defineSymbol(nodes[2], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "MethodDeclaration",
            "line": 7,
            "name": "methodDeclare(): string {",
            "path": ".DeclaredClass.methodDeclare",
          },
        ],
        "type": "() => string",
      }
    `);
  });

  it("should resolve parameter properties", () => {
    const nodes = lookupNamedToken("readonlyParameterProp");

    // Identity
    expect(dumpInferred(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 8,
            "fileName": "test.tsx",
            "kind": "Parameter",
            "line": 33,
            "name": "public readonly readonlyParameterProp: number",
            "path": ".Expression.Constructor().readonlyParameterProp",
          },
        ],
        "type": "number",
      }
    `);

    // Access
    expect(dumpInferred(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 8,
            "fileName": "test.tsx",
            "kind": "Parameter",
            "line": 33,
            "name": "public readonly readonlyParameterProp: number",
            "path": ".Expression.Constructor().readonlyParameterProp",
          },
        ],
        "type": "number",
      }
    `);
  });

  it("should resolve parent properties", () => {
    const nodes = lookupNamedToken("propParent");

    // Identity
    expect(dumpInferred(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "PropertyDeclaration",
            "line": 5,
            "name": "propParent: string;",
            "path": ".DeclaredClass.propParent",
          },
        ],
        "type": "string",
      }
    `);

    // Access
    expect(dumpInferred(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "PropertyDeclaration",
            "line": 5,
            "name": "propParent: string;",
            "path": ".DeclaredClass.propParent",
          },
        ],
        "type": "string",
      }
    `);
  });
  it("should resolve immediate properties", () => {
    const nodes = lookupNamedToken("propInit");

    // Identity
    expect(dumpInferred(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "PropertyDeclaration",
            "line": 29,
            "name": "propInit = 'foo';",
            "path": ".Expression.propInit",
          },
        ],
        "type": "string",
      }
    `);

    // Access
    expect(dumpInferred(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "PropertyDeclaration",
            "line": 29,
            "name": "propInit = 'foo';",
            "path": ".Expression.propInit",
          },
        ],
        "type": "string",
      }
    `);
  });

  it("should handle private fields", () => {
    const nodes = findNodesInTree(sourceFile, ts.isPrivateIdentifier);

    // Declaration
    expect(dumpInferred(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "PropertyDeclaration",
            "line": 11,
            "name": "#_length = 0;",
            "path": ".DeclaredClass.#_length",
          },
        ],
        "type": "number",
      }
    `);

    // Reference
    expect(dumpInferred(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "PropertyDeclaration",
            "line": 11,
            "name": "#_length = 0;",
            "path": ".DeclaredClass.#_length",
          },
        ],
        "type": "number",
      }
    `);

    // Assign
    expect(dumpInferred(defineSymbol(nodes[2], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "PropertyDeclaration",
            "line": 11,
            "name": "#_length = 0;",
            "path": ".DeclaredClass.#_length",
          },
        ],
        "type": "number",
      }
    `);
  });

  it("should handle override", () => {
    const overrideNodes = findNodesInTree(
      sourceFile,
      (node): node is ts.OverrideKeyword =>
        node.kind === ts.SyntaxKind.OverrideKeyword
    );
    expect(dumpInferred(defineSymbol(overrideNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 6,
            "fileName": "test.tsx",
            "kind": "MethodDeclaration",
            "line": 39,
            "name": "override methodDeclare(): string {",
            "path": ".Expression.methodDeclare",
          },
        ],
        "type": "() => string",
      }
    `);
  });
  it("should handle override", () => {
    const overrideNodes = findNodesInTree(
      sourceFile,
      (node): node is ts.Node => node.kind === ts.SyntaxKind.ThisKeyword
    );
    expect(dumpInferred(defineSymbol(overrideNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 4,
            "fileName": "test.tsx",
            "kind": "ClassDeclaration",
            "line": 3,
            "name": "class DeclaredClass implements Foo {",
            "path": ".DeclaredClass",
          },
        ],
        "type": "typeof DeclaredClass",
      }
    `);
  });
});
