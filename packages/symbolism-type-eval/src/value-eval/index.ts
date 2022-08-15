import { defineSymbol } from "@symbolism/definitions";
import { getSymbolDeclaration } from "@symbolism/ts-utils";
import { logDebug, NodeError } from "@symbolism/utils";
import ts from "typescript";
import { AnySchemaNode, convertTSTypeToSchema } from "../schema";
import { SchemaContext } from "../context";
import { convertBinaryExpression } from "./binary-expression";
import { convertObjectLiteralValue } from "./object";
import { convertTemplateLiteralValue } from "./string-template";
import { convertArrayLiteralValue } from "./array";
import { dumpNode } from "@symbolism/ts-debug";

export type TypeEvalOptions = {
  allowMissing?: boolean;
};

export function narrowTypeFromValues(
  type: ts.Type,
  context: SchemaContext
): AnySchemaNode | undefined {
  const { contextNode, checker } = context;

  const symbol = type.getSymbol();
  const symbolDeclaration = getSymbolDeclaration(symbol);

  if (context.narrowingNode === contextNode) {
    throw new NodeError("Circular narrowing node", contextNode, checker);
  }

  // Create a new context to create a new circular reference check scope.
  // This allows for independent resolution of these distinct types. The
  // narrowingNode check ensures that we don't infinitely recurse.
  const newContext = new SchemaContext(contextNode, context.checker);
  newContext.narrowingNode = contextNode;

  if (symbolDeclaration) {
    const symbolSchema = convertValueDeclaration(
      ...newContext.cloneNode(symbolDeclaration),
      {
        allowMissing: true,
      }
    );
    if (symbolSchema) {
      return symbolSchema;
    }
  }

  if (contextNode) {
    // If we are using the context node, we will need to resolve where it lives.
    const contextDefinition = defineSymbol(contextNode, checker, {
      chooseLocal: false,
    });
    if (contextDefinition?.declaration) {
      const contextSchema = convertValueDeclaration(
        ...newContext.cloneNode(contextDefinition.declaration),
        {
          allowMissing: true,
        }
      );
      if (contextSchema) {
        return contextSchema;
      }
    }

    const contextSchema = convertValueExpression(
      ...newContext.cloneNode(contextNode as ts.Expression),
      {
        allowMissing: true,
      }
    );
    if (contextSchema) {
      return contextSchema;
    }
  }
}

export function convertValueDeclaration(
  node: ts.Declaration,
  context: SchemaContext,
  options: TypeEvalOptions
): AnySchemaNode | undefined {
  try {
    if (
      ts.isVariableDeclaration(node) ||
      ts.isParameter(node) ||
      ts.isBindingElement(node) ||
      ts.isPropertySignature(node) ||
      ts.isPropertyDeclaration(node) ||
      ts.isPropertyAssignment(node)
    ) {
      if (node.initializer) {
        return convertValueExpression(
          ...context.cloneNode(node.initializer),
          options
        );
      }
    }
    if (ts.isExpressionStatement(node)) {
      return convertValueExpression(
        ...context.cloneNode(node.expression),
        options
      );
    }
    if (ts.isTypeAliasDeclaration(node)) {
      const secondDefinition = defineSymbol(node.type, context.checker, {
        chooseLocal: false,
      });
      const secondDeclaration = getSymbolDeclaration(secondDefinition?.symbol);

      if (secondDeclaration) {
        return convertValueDeclaration(
          ...context.cloneNode(secondDeclaration),
          options
        );
      }
    }
  } catch (err: any) {
    throw new NodeError(
      "Failed to convert value declaration",
      node,
      context.checker,
      err
    );
  }
}

export function convertValueExpression(
  node: ts.Node,
  context: SchemaContext,
  options: TypeEvalOptions
): AnySchemaNode | undefined {
  try {
    const { checker } = context;

    if (ts.isParenthesizedExpression(node)) {
      return convertValueExpression(
        ...context.cloneNode(node.expression),
        options
      );
    }

    if (ts.isIdentifier(node)) {
      const identifierDefinition = defineSymbol(node, checker, {
        chooseLocal: false,
      });
      const identifierDeclaration = getSymbolDeclaration(
        identifierDefinition?.symbol
      );

      if (identifierDeclaration) {
        return convertValueDeclaration(
          ...context.cloneNode(identifierDeclaration),
          options
        );
      }

      return {
        kind: "primitive",
        name: "any",
        node,
      };
    }

    if (
      ts.isLiteralExpression(node) ||
      [
        ts.SyntaxKind.TrueKeyword,
        ts.SyntaxKind.FalseKeyword,
        ts.SyntaxKind.NullKeyword,
        ts.SyntaxKind.UndefinedKeyword,
        ts.SyntaxKind.VoidKeyword,
      ].includes(node.kind)
    ) {
      return convertNode(node, context);
    }

    if (ts.isTemplateExpression(node)) {
      return convertTemplateLiteralValue(node, context);
    }

    if (ts.isBinaryExpression(node)) {
      return convertBinaryExpression(node, context);
    }

    if (ts.isObjectLiteralExpression(node)) {
      return convertObjectLiteralValue(node, context);
    }

    if (ts.isComputedPropertyName(node)) {
      return convertValueExpression(
        ...context.cloneNode(node.expression),
        options
      );
    }

    if (ts.isElementAccessExpression(node)) {
      const parentSchema = convertValueExpression(
        ...context.cloneNode(node.expression),
        { allowMissing: true }
      ) || {
        kind: "primitive",
        name: "any",
        node: node.expression,
      };
      const argumentSchema = convertValueExpression(
        ...context.cloneNode(node.argumentExpression),
        { allowMissing: true }
      ) || {
        kind: "primitive",
        name: "any",
        node: node.argumentExpression,
      };

      if (parentSchema.kind === "object") {
        if (argumentSchema.kind === "primitive") {
          return {
            kind: "union",
            items: [
              Object.values(parentSchema.properties).concat(
                parentSchema.abstractIndexKeys.map(({ value }) => value)
              ),
            ].flat(),
          };
        } else if (argumentSchema.kind === "literal") {
          const argValue = argumentSchema.value as string | number;
          if (argValue in parentSchema.properties) {
            return parentSchema.properties[argValue];
          }
        } else {
          return {
            kind: "literal",
            value: undefined,
          };
        }
      } else if (parentSchema.kind === "array") {
        return parentSchema.items;
      } else if (
        parentSchema.kind === "primitive" &&
        parentSchema.name === "any"
      ) {
        return parentSchema;
      }
    }

    if (ts.isArrayLiteralExpression(node)) {
      return convertArrayLiteralValue(node, context);
    }

    if (!options.allowMissing) {
      throw new Error(`Unsupported expression: ${ts.SyntaxKind[node.kind]}`);
    } else {
      logDebug(
        `Unsupported expression: ${
          ts.SyntaxKind[node.kind]
        }\n\nNode: ${JSON.stringify(dumpNode(node, checker))}`
      );
    }
  } catch (err: any) {
    throw new NodeError(
      "Failed to convert value expression",
      node,
      context.checker,
      err
    );
  }
}

export function convertNode(node: ts.Node, context: SchemaContext) {
  const { checker } = context;

  const definition = defineSymbol(node, checker, { chooseLocal: false });

  return definition?.declaration && definition?.type
    ? convertTSTypeToSchema(...context.clone(definition.type, node))
    : convertTSTypeToSchema(...context.clone(undefined, node));
}
