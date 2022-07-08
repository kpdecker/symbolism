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
    import React from 'react';
    import styled from '@emotion/styled';

    const SimpleTemplate = styled.div\`
      color: red;
    \`;

    const GenericTemplate = styled.div<{ myProp: number }>\`
      color: red;
      \${({ myProp }) => myProp}
    \`;


    const foo = (
      <div>{bar}</div>
    );

    function Bar() {
      return <></>;
    }

    const bat = { Bar };

    export function MyComponent() {
      return (
        <soup>
          <SimpleTemplate />
          {foo}
          <GenericTemplate myProp={1} {...bat} />
          <bat.Bar myProp={2} />
        </soup>
      );
    }
  `,
});
const checker = program.getTypeChecker();
const sourceFile = program.getSourceFile("test.tsx")!;

function lookupNamedToken(node: ts.Node, name: string) {
  return findNodesInTree(sourceFile, (node): node is ts.Identifier => {
    return ts.isIdentifier(node) && node.text === name;
  });
}

describe("react", () => {
  it("should resolve imported types", () => {
    const styledNodes = lookupNamedToken(sourceFile, "styled");
    const styledDefinition = defineSymbol(styledNodes[1], checker);
    expect(dumpInferred(styledDefinition, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 11,
            "fileName": "test.tsx",
            "kind": "ImportClause",
            "line": 3,
            "name": "styled",
            "path": ".ImportDeclaration().ImportClause()",
          },
        ],
        "type": "CreateStyled",
      }
    `);
  });
  it("should resolve template literals", () => {
    const simpleTemplateNodes = lookupNamedToken(sourceFile, "SimpleTemplate");
    const simpleTemplateDefinition = defineSymbol(
      simpleTemplateNodes[1],
      checker
    );
    expect(dumpInferred(simpleTemplateDefinition, checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 10,
            "fileName": "test.tsx",
            "kind": "VariableDeclaration",
            "line": 5,
            "name": "SimpleTemplate = styled.div\`",
            "path": ".SimpleTemplate",
          },
        ],
        "type": "StyledComponent<{ theme?: Theme; as?: ElementType<any>; }, DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>, {}>",
      }
    `);
  });
  it("should resolve tagged template literals", () => {
    const genericTemplateNodes = lookupNamedToken(
      sourceFile,
      "GenericTemplate"
    );
    const genericTemplateDefinition = defineSymbol(
      genericTemplateNodes[1],
      checker
    );
    expect(dumpInferred(genericTemplateDefinition, checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 10,
            "fileName": "test.tsx",
            "kind": "VariableDeclaration",
            "line": 9,
            "name": "GenericTemplate = styled.div<{ myProp: number }>\`",
            "path": ".GenericTemplate",
          },
        ],
        "type": "StyledComponent<{ theme?: Theme; as?: ElementType<any>; } & { myProp: number; }, DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>, {}>",
      }
    `);
  });
  it("should resolve jsx attributes in styled template", () => {
    const propertyNodes = lookupNamedToken(sourceFile, "myProp");
    const arrowDefinition = defineSymbol(propertyNodes[2].parent, checker);
    expect(dumpInferred(arrowDefinition, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 8,
            "fileName": "test.tsx",
            "kind": "ArrowFunction",
            "line": 11,
            "name": "({ myProp }) => myProp",
            "path": ".GenericTemplate.ArrowFunction()",
          },
        ],
        "type": "({ myProp }: { theme?: Theme; as?: ElementType<any>; } & ClassAttributes<HTMLDivElement> & HTMLAttributes<HTMLDivElement> & { ...; } & { ...; }) => number",
      }
    `);
    const propertyDefinition = defineSymbol(propertyNodes[1], checker);
    expect(dumpInferred(propertyDefinition, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 41,
            "fileName": "test.tsx",
            "kind": "PropertySignature",
            "line": 9,
            "name": "myProp: number",
            "path": ".GenericTemplate.myProp",
          },
        ],
        "type": "number",
      }
    `);
  });
  it("should resolve jsx attributes", () => {
    const propertyNodes = lookupNamedToken(sourceFile, "myProp");
    const propertyDefinition = defineSymbol(propertyNodes[3], checker);
    expect(dumpInferred(propertyDefinition, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 41,
            "fileName": "test.tsx",
            "kind": "PropertySignature",
            "line": 9,
            "name": "myProp: number",
            "path": ".GenericTemplate.myProp",
          },
        ],
        "type": "number",
      }
    `);
  });
  it("should handle jsx expressions", () => {
    const fooNodes = lookupNamedToken(sourceFile, "foo");
    const fooDefinition = defineSymbol(fooNodes[1], checker);
    expect(dumpInferred(fooDefinition, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 10,
            "fileName": "test.tsx",
            "kind": "VariableDeclaration",
            "line": 15,
            "name": "foo = (",
            "path": ".foo",
          },
        ],
        "type": "Element",
      }
    `);
  });
  it("should resolve jsx spread operators", () => {
    const styledNodes = lookupNamedToken(sourceFile, "bat");
    const componentNode = styledNodes[1].parent;
    const styledDefinition = defineSymbol(componentNode, checker);
    expect(dumpInferred(styledDefinition, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 10,
            "fileName": "test.tsx",
            "kind": "VariableDeclaration",
            "line": 23,
            "name": "bat = { Bar }",
            "path": ".bat",
          },
        ],
        "type": "{ Bar: () => Element; }",
      }
    `);
  });
  it("should resolve jsx return", () => {
    const myComponentNodes = lookupNamedToken(sourceFile, "MyComponent");
    const myComponentDefinition = defineSymbol(myComponentNodes[0], checker);
    expect(dumpInferred(myComponentDefinition, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 4,
            "fileName": "test.tsx",
            "kind": "FunctionDeclaration",
            "line": 25,
            "name": "MyComponent",
            "path": ".MyComponent",
          },
        ],
        "type": "() => Element",
      }
    `);
  });
  it("should resolve jsx element property access", () => {
    const styledNodes = lookupNamedToken(sourceFile, "Bar");
    const componentNode = styledNodes[1].parent;
    const styledDefinition = defineSymbol(componentNode, checker);
    expect(dumpInferred(styledDefinition, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 18,
            "fileName": "test.tsx",
            "kind": "ShorthandPropertyAssignment",
            "line": 23,
            "name": "Bar",
            "path": ".bat.ShorthandPropertyAssignment()",
          },
        ],
        "type": "() => Element",
      }
    `);
  });
  it("should resolve jsx intrinsic element", () => {
    const styledNodes = lookupNamedToken(sourceFile, "div");
    const componentNode = styledNodes[2].parent;
    const styledDefinition = defineSymbol(componentNode, checker);
    const dump = dumpInferred(styledDefinition, checker);
    expect(dump).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 12,
            "fileName": "@types/react/index.d.ts",
            "kind": "PropertySignature",
            "line": 3171,
            "name": "div: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;",
            "path": ".global.JSX.IntrinsicElements.div",
          },
        ],
        "type": "DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>",
      }
    `);
  });
  // TODO: Object literal inference in attributes
});
