import { dumpDefinition } from "@symbolism/ts-debug";
import { findNodesInTree } from "@symbolism/ts-utils";
import ts from "typescript";
import { mockProgram } from "../../test/utils";
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

    function thisType(this: DeclaredClass) {
      return this.propParent;
    }

    new Expression(1, 2);
    new DeclaredClass();
  `,
});
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
    expect(dumpDefinition(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 5,
            "fileName": "test.tsx",
            "kind": "ClassDeclaration",
            "line": 3,
            "name": "class DeclaredClass implements Foo {",
            "path": "DeclaredClass",
          },
        ],
        "type": "DeclaredClass",
      }
    `);

    // Instantiate
    expect(dumpDefinition(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 5,
            "fileName": "test.tsx",
            "kind": "ClassDeclaration",
            "line": 3,
            "name": "class DeclaredClass implements Foo {",
            "path": "DeclaredClass",
          },
        ],
        "type": "typeof DeclaredClass",
      }
    `);

    // Extends
    expect(dumpDefinition(defineSymbol(nodes[2], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 5,
            "fileName": "test.tsx",
            "kind": "ClassDeclaration",
            "line": 3,
            "name": "class DeclaredClass implements Foo {",
            "path": "DeclaredClass",
          },
        ],
        "type": "typeof DeclaredClass",
      }
    `);
  });
  it("should resolve class expression", () => {
    const nodes = lookupNamedToken("Expression");

    // Identity
    expect(dumpDefinition(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 11,
            "fileName": "test.tsx",
            "kind": "VariableDeclaration",
            "line": 28,
            "name": "Expression = class extends DeclaredClass {",
            "path": "Expression",
          },
        ],
        "type": "typeof Expression",
      }
    `);

    // Use
    expect(dumpDefinition(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 11,
            "fileName": "test.tsx",
            "kind": "VariableDeclaration",
            "line": 28,
            "name": "Expression = class extends DeclaredClass {",
            "path": "Expression",
          },
        ],
        "type": "typeof Expression",
      }
    `);
  });
  it("should resolve implements", () => {
    const nodes = lookupNamedToken("Foo");

    expect(dumpDefinition(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 5,
            "fileName": "test.tsx",
            "kind": "InterfaceDeclaration",
            "line": 2,
            "name": "interface Foo { foo: string }",
            "path": "Foo",
          },
        ],
        "type": "Foo",
      }
    `);
  });

  it("should resolve interface properties", () => {
    const nodes = lookupNamedToken("foo");

    // Identity
    expect(dumpDefinition(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 21,
            "fileName": "test.tsx",
            "kind": "PropertySignature",
            "line": 2,
            "name": "foo: string",
            "path": "Foo.foo",
          },
        ],
        "type": "string",
      }
    `);

    // Implementation
    expect(dumpDefinition(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 21,
            "fileName": "test.tsx",
            "kind": "PropertySignature",
            "line": 2,
            "name": "foo: string",
            "path": "Foo.foo",
          },
        ],
        "type": "string",
      }
    `);

    //  Extends Definition
    expect(dumpDefinition(defineSymbol(nodes[2], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 21,
            "fileName": "test.tsx",
            "kind": "PropertySignature",
            "line": 2,
            "name": "foo: string",
            "path": "Foo.foo",
          },
        ],
        "type": "string",
      }
    `);

    // Reference
    expect(dumpDefinition(defineSymbol(nodes[3], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 21,
            "fileName": "test.tsx",
            "kind": "PropertySignature",
            "line": 2,
            "name": "foo: string",
            "path": "Foo.foo",
          },
        ],
        "type": "string",
      }
    `);
  });
  it("should resolve getter and setter", () => {
    const nodes = lookupNamedToken("length");

    // Getter
    expect(dumpDefinition(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 7,
            "fileName": "test.tsx",
            "kind": "GetAccessor",
            "line": 12,
            "name": "get length() {",
            "path": "DeclaredClass.length",
          },
          Object {
            "column": 7,
            "fileName": "test.tsx",
            "kind": "SetAccessor",
            "line": 15,
            "name": "set length(value) {",
            "path": "DeclaredClass.length",
          },
        ],
        "type": "number",
      }
    `);

    // Setter
    expect(dumpDefinition(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 7,
            "fileName": "test.tsx",
            "kind": "GetAccessor",
            "line": 12,
            "name": "get length() {",
            "path": "DeclaredClass.length",
          },
          Object {
            "column": 7,
            "fileName": "test.tsx",
            "kind": "SetAccessor",
            "line": 15,
            "name": "set length(value) {",
            "path": "DeclaredClass.length",
          },
        ],
        "type": "number",
      }
    `);

    //  Read
    expect(dumpDefinition(defineSymbol(nodes[2], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 7,
            "fileName": "test.tsx",
            "kind": "GetAccessor",
            "line": 12,
            "name": "get length() {",
            "path": "DeclaredClass.length",
          },
          Object {
            "column": 7,
            "fileName": "test.tsx",
            "kind": "SetAccessor",
            "line": 15,
            "name": "set length(value) {",
            "path": "DeclaredClass.length",
          },
        ],
        "type": "number",
      }
    `);

    // Assign
    expect(dumpDefinition(defineSymbol(nodes[3], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 7,
            "fileName": "test.tsx",
            "kind": "GetAccessor",
            "line": 12,
            "name": "get length() {",
            "path": "DeclaredClass.length",
          },
          Object {
            "column": 7,
            "fileName": "test.tsx",
            "kind": "SetAccessor",
            "line": 15,
            "name": "set length(value) {",
            "path": "DeclaredClass.length",
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
    expect(dumpDefinition(defineSymbol(constructorNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 24,
            "fileName": "test.tsx",
            "kind": "ClassExpression",
            "line": 28,
            "name": "class extends DeclaredClass {",
            "path": "Expression",
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
    expect(dumpDefinition(defineSymbol(superNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 5,
            "fileName": "test.tsx",
            "kind": "ClassDeclaration",
            "line": 3,
            "name": "class DeclaredClass implements Foo {",
            "path": "DeclaredClass",
          },
        ],
        "type": "typeof DeclaredClass",
      }
    `);
    expect(dumpDefinition(defineSymbol(superNodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 5,
            "fileName": "test.tsx",
            "kind": "ClassDeclaration",
            "line": 3,
            "name": "class DeclaredClass implements Foo {",
            "path": "DeclaredClass",
          },
        ],
        "type": "typeof DeclaredClass",
      }
    `);
  });

  it("should resolve method declarations", () => {
    const nodes = lookupNamedToken("methodDeclare");

    // Identity
    expect(dumpDefinition(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 7,
            "fileName": "test.tsx",
            "kind": "MethodDeclaration",
            "line": 7,
            "name": "methodDeclare(): string {",
            "path": "DeclaredClass.methodDeclare",
          },
        ],
        "type": "() => string",
      }
    `);

    // Override
    expect(dumpDefinition(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 7,
            "fileName": "test.tsx",
            "kind": "MethodDeclaration",
            "line": 7,
            "name": "methodDeclare(): string {",
            "path": "DeclaredClass.methodDeclare",
          },
        ],
        "type": "() => string",
      }
    `);
    expect(dumpDefinition(defineSymbol(nodes[2], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 7,
            "fileName": "test.tsx",
            "kind": "MethodDeclaration",
            "line": 7,
            "name": "methodDeclare(): string {",
            "path": "DeclaredClass.methodDeclare",
          },
        ],
        "type": "() => string",
      }
    `);
  });

  it("should resolve parameter properties", () => {
    const nodes = lookupNamedToken("readonlyParameterProp");

    // Identity
    expect(dumpDefinition(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 9,
            "fileName": "test.tsx",
            "kind": "Parameter",
            "line": 33,
            "name": "public readonly readonlyParameterProp: number",
            "path": "Expression().readonlyParameterProp",
          },
        ],
        "type": "number",
      }
    `);

    // Access
    expect(dumpDefinition(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 9,
            "fileName": "test.tsx",
            "kind": "Parameter",
            "line": 33,
            "name": "public readonly readonlyParameterProp: number",
            "path": "Expression().readonlyParameterProp",
          },
        ],
        "type": "number",
      }
    `);
  });

  it("should resolve parent properties", () => {
    const nodes = lookupNamedToken("propParent");

    // Identity
    expect(dumpDefinition(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 7,
            "fileName": "test.tsx",
            "kind": "PropertyDeclaration",
            "line": 5,
            "name": "propParent: string;",
            "path": "DeclaredClass.propParent",
          },
        ],
        "type": "string",
      }
    `);

    // Access
    expect(dumpDefinition(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 7,
            "fileName": "test.tsx",
            "kind": "PropertyDeclaration",
            "line": 5,
            "name": "propParent: string;",
            "path": "DeclaredClass.propParent",
          },
        ],
        "type": "string",
      }
    `);
  });
  it("should resolve immediate properties", () => {
    const nodes = lookupNamedToken("propInit");

    // Identity
    expect(dumpDefinition(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 7,
            "fileName": "test.tsx",
            "kind": "PropertyDeclaration",
            "line": 29,
            "name": "propInit = 'foo';",
            "path": "Expression.propInit",
          },
        ],
        "type": "string",
      }
    `);

    // Access
    expect(dumpDefinition(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 7,
            "fileName": "test.tsx",
            "kind": "PropertyDeclaration",
            "line": 29,
            "name": "propInit = 'foo';",
            "path": "Expression.propInit",
          },
        ],
        "type": "string",
      }
    `);
  });

  it("should handle private fields", () => {
    const nodes = findNodesInTree(sourceFile, ts.isPrivateIdentifier);

    // Declaration
    expect(dumpDefinition(defineSymbol(nodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 7,
            "fileName": "test.tsx",
            "kind": "PropertyDeclaration",
            "line": 11,
            "name": "#_length = 0;",
            "path": "DeclaredClass.#_length",
          },
        ],
        "type": "number",
      }
    `);

    // Reference
    expect(dumpDefinition(defineSymbol(nodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 7,
            "fileName": "test.tsx",
            "kind": "PropertyDeclaration",
            "line": 11,
            "name": "#_length = 0;",
            "path": "DeclaredClass.#_length",
          },
        ],
        "type": "number",
      }
    `);

    // Assign
    expect(dumpDefinition(defineSymbol(nodes[2], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 7,
            "fileName": "test.tsx",
            "kind": "PropertyDeclaration",
            "line": 11,
            "name": "#_length = 0;",
            "path": "DeclaredClass.#_length",
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
    expect(dumpDefinition(defineSymbol(overrideNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 7,
            "fileName": "test.tsx",
            "kind": "MethodDeclaration",
            "line": 39,
            "name": "override methodDeclare(): string {",
            "path": "Expression.methodDeclare",
          },
        ],
        "type": "() => string",
      }
    `);
  });
  it("should handle this", () => {
    const thisNodes = findNodesInTree(
      sourceFile,
      (node): node is ts.Node => node.kind === ts.SyntaxKind.ThisKeyword
    );

    // Access in declaration class
    expect(dumpDefinition(defineSymbol(thisNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 5,
            "fileName": "test.tsx",
            "kind": "ClassDeclaration",
            "line": 3,
            "name": "class DeclaredClass implements Foo {",
            "path": "DeclaredClass",
          },
        ],
        "type": "this",
      }
    `);

    // Access of parent in subclass
    expect(dumpDefinition(defineSymbol(thisNodes[2], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 24,
            "fileName": "test.tsx",
            "kind": "ClassExpression",
            "line": 28,
            "name": "class extends DeclaredClass {",
            "path": "Expression",
          },
        ],
        "type": "this",
      }
    `);

    // Access of self in subclass
    expect(dumpDefinition(defineSymbol(thisNodes[3], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 24,
            "fileName": "test.tsx",
            "kind": "ClassExpression",
            "line": 28,
            "name": "class extends DeclaredClass {",
            "path": "Expression",
          },
        ],
        "type": "this",
      }
    `);

    // Via this type
    expect(dumpDefinition(defineSymbol(thisNodes[8], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 5,
            "fileName": "test.tsx",
            "kind": "ClassDeclaration",
            "line": 3,
            "name": "class DeclaredClass implements Foo {",
            "path": "DeclaredClass",
          },
        ],
        "type": "DeclaredClass",
      }
    `);
    expect(dumpDefinition(defineSymbol(thisNodes[8].parent, checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 7,
            "fileName": "test.tsx",
            "kind": "PropertyDeclaration",
            "line": 5,
            "name": "propParent: string;",
            "path": "DeclaredClass.propParent",
          },
        ],
        "type": "string",
      }
    `);
  });
});
