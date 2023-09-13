import { dumpDefinition } from "@noom/symbolism-ts-debug";
import { findIdentifiers, findNodeInTree } from "@noom/symbolism-ts-utils";
import ts from "typescript";
import { mockProgram } from "../../test/utils";
import { defineSymbol } from "../index";

const program = mockProgram({
  "test.tsx": `
    import React, { ReactNode } from 'react';
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
          <GenericTemplate myProp={1} {...bat} ignore-prop />
          <bat.Bar myProp={2} />
        </soup>
      );
    }

    export function WithInlineProps({ children }: { children: ReactNode; }) {
      return <>
        {bat && children}
        <WithAnyProps anyProp />
      </>;
    }

    export function WithAnyProps({ anyProp }) {
      return <>{anyProp}</>;
    }
  `,
});
const checker = program.getTypeChecker();
const sourceFile = program.getSourceFile("test.tsx")!;

describe("react", () => {
  it("should resolve imported types", () => {
    const styledNodes = findIdentifiers(sourceFile, "styled");
    const styledDefinition = defineSymbol(styledNodes[1], checker);
    expect(dumpDefinition(styledDefinition, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "VariableDeclaration",
            "location": "node_modules/@emotion/styled/types/index.d.ts:31:15",
            "name": "styled: CreateStyled",
            "path": "styled",
          },
        ],
        "type": "CreateStyled",
      }
    `);
  });
  it("should resolve template literals", () => {
    const simpleTemplateNodes = findIdentifiers(sourceFile, "SimpleTemplate");
    const simpleTemplateDefinition = defineSymbol(
      simpleTemplateNodes[1],
      checker
    );
    expect(dumpDefinition(simpleTemplateDefinition, checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "VariableDeclaration",
            "location": "test.tsx:5:11",
            "name": "SimpleTemplate = styled.div\`",
            "path": "SimpleTemplate",
          },
        ],
        "type": "StyledComponent<{ theme?: Theme; as?: ElementType<any>; }, DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>, {}>",
      }
    `);
  });
  it("should resolve tagged template literals", () => {
    const genericTemplateNodes = findIdentifiers(sourceFile, "GenericTemplate");
    const genericTemplateDefinition = defineSymbol(
      genericTemplateNodes[1],
      checker
    );
    expect(dumpDefinition(genericTemplateDefinition, checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "VariableDeclaration",
            "location": "test.tsx:9:11",
            "name": "GenericTemplate = styled.div<{ myProp: number }>\`",
            "path": "GenericTemplate",
          },
        ],
        "type": "StyledComponent<{ theme?: Theme; as?: ElementType<any>; } & { myProp: number; }, DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>, {}>",
      }
    `);
  });
  it("should resolve jsx attributes in styled template", () => {
    const propertyNodes = findIdentifiers(sourceFile, "myProp");
    const arrowDefinition = defineSymbol(propertyNodes[2].parent, checker);
    expect(dumpDefinition(arrowDefinition, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "ArrowFunction",
            "location": "test.tsx:11:9",
            "name": "({ myProp }) => myProp",
            "path": "GenericTemplate.=>",
          },
        ],
        "type": "({ myProp }: { theme?: Theme; as?: ElementType<any>; } & ClassAttributes<HTMLDivElement> & HTMLAttributes<HTMLDivElement> & { ...; } & { ...; }) => number",
      }
    `);
    const propertyDefinition = defineSymbol(propertyNodes[1], checker);
    expect(dumpDefinition(propertyDefinition, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "PropertySignature",
            "location": "test.tsx:9:42",
            "name": "myProp: number",
            "path": "GenericTemplate.myProp",
          },
        ],
        "type": "number",
      }
    `);
  });
  it("should resolve jsx attributes", () => {
    const propertyNodes = findIdentifiers(sourceFile, "myProp");
    const propertyDefinition = defineSymbol(propertyNodes[3], checker);
    expect(dumpDefinition(propertyDefinition, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "PropertySignature",
            "location": "test.tsx:9:42",
            "name": "myProp: number",
            "path": "GenericTemplate.myProp",
          },
        ],
        "type": "number",
      }
    `);
  });
  it("should handle jsx expressions", () => {
    const fooNodes = findIdentifiers(sourceFile, "foo");
    const fooDefinition = defineSymbol(fooNodes[1], checker);
    expect(dumpDefinition(fooDefinition, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "VariableDeclaration",
            "location": "test.tsx:15:11",
            "name": "foo = (",
            "path": "foo",
          },
        ],
        "type": "Element",
      }
    `);
    const fooExpression = defineSymbol(fooNodes[1].parent, checker);
    expect(dumpDefinition(fooExpression, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "VariableDeclaration",
            "location": "test.tsx:15:11",
            "name": "foo = (",
            "path": "foo",
          },
        ],
        "type": "Element",
      }
    `);
  });
  it("should resolve jsx spread operators", () => {
    const styledNodes = findIdentifiers(sourceFile, "bat");
    const componentNode = styledNodes[1].parent;
    const styledDefinition = defineSymbol(componentNode, checker);
    expect(dumpDefinition(styledDefinition, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "VariableDeclaration",
            "location": "test.tsx:23:11",
            "name": "bat = { Bar }",
            "path": "bat",
          },
        ],
        "type": "{ Bar: () => Element; }",
      }
    `);
  });
  it("should resolve jsx return", () => {
    const myComponentNodes = findIdentifiers(sourceFile, "MyComponent");
    const myComponentDefinition = defineSymbol(myComponentNodes[0], checker);
    expect(dumpDefinition(myComponentDefinition, checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "FunctionDeclaration",
            "location": "test.tsx:25:5",
            "name": "MyComponent",
            "path": "MyComponent",
          },
        ],
        "type": "() => Element",
      }
    `);
  });
  it("should resolve jsx element property access", () => {
    const styledNodes = findIdentifiers(sourceFile, "Bar");
    const componentNode = styledNodes[1].parent;
    const styledDefinition = defineSymbol(componentNode, checker);
    expect(dumpDefinition(styledDefinition, checker)).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "ShorthandPropertyAssignment",
            "location": "test.tsx:23:19",
            "name": "Bar",
            "path": "bat.Bar",
          },
        ],
        "type": "() => Element",
      }
    `);
  });
  it("should resolve jsx intrinsic element", () => {
    const styledNodes = findIdentifiers(sourceFile, "div");
    const componentNode = styledNodes[2].parent;
    const styledDefinition = defineSymbol(componentNode, checker);
    const dump = dumpDefinition(styledDefinition, checker);
    expect(dump).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "PropertySignature",
            "location": "node_modules/@types/react/index.d.ts:3171:13",
            "name": "div: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;",
            "path": "global.JSX.IntrinsicElements.div",
          },
        ],
        "type": "DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>",
      }
    `);
  });
  it("should resolve fragments", () => {
    const fragmentNode = findNodeInTree(sourceFile, ts.isJsxFragment)!;
    expect(dumpDefinition(defineSymbol(fragmentNode, checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": undefined,
        "type": "any",
      }
    `);
    expect(
      dumpDefinition(
        defineSymbol(fragmentNode.closingFragment, checker),
        checker
      )
    ).toMatchInlineSnapshot(`
      Object {
        "symbol": undefined,
        "type": "any",
      }
    `);
  });

  it("should resolve property parameters", () => {
    const childrenNodes = findIdentifiers(sourceFile, "children");

    // Declaration
    expect(dumpDefinition(defineSymbol(childrenNodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "PropertySignature",
            "location": "test.tsx:36:53",
            "name": "children: ReactNode;",
            "path": "WithInlineProps.children",
          },
        ],
        "type": "ReactNode",
      }
    `);

    // Destructure
    expect(dumpDefinition(defineSymbol(childrenNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "PropertySignature",
            "location": "test.tsx:36:53",
            "name": "children: ReactNode;",
            "path": "WithInlineProps.children",
          },
        ],
        "type": "ReactNode",
      }
    `);

    // Use
    expect(dumpDefinition(defineSymbol(childrenNodes[2], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "PropertySignature",
            "location": "test.tsx:36:53",
            "name": "children: ReactNode;",
            "path": "WithInlineProps.children",
          },
        ],
        "type": "ReactNode",
      }
    `);
  });

  it("should ignore dash props", () => {
    const ignorePropNodes = findIdentifiers(sourceFile, "ignore-prop");
    expect(dumpDefinition(defineSymbol(ignorePropNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "JsxAttribute",
            "location": "test.tsx:30:48",
            "name": "ignore-prop",
            "path": "GenericTemplate.ignore-prop",
          },
        ],
        "type": "true",
      }
    `);
  });

  it("should handle implicit any props", () => {
    const ignorePropNodes = findIdentifiers(sourceFile, "anyProp");

    // Attribute
    expect(dumpDefinition(defineSymbol(ignorePropNodes[0], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "BindingElement",
            "location": "test.tsx:43:36",
            "name": "anyProp",
            "path": "WithAnyProps.anyProp",
          },
        ],
        "type": "any",
      }
    `);

    // Definition
    expect(dumpDefinition(defineSymbol(ignorePropNodes[1], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "BindingElement",
            "location": "test.tsx:43:36",
            "name": "anyProp",
            "path": "WithAnyProps.anyProp",
          },
        ],
        "type": "any",
      }
    `);

    // Use
    expect(dumpDefinition(defineSymbol(ignorePropNodes[2], checker), checker))
      .toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "BindingElement",
            "location": "test.tsx:43:36",
            "name": "anyProp",
            "path": "WithAnyProps.anyProp",
          },
        ],
        "type": "any",
      }
    `);
  });

  // TODO: Object literal inference in attributes
});
