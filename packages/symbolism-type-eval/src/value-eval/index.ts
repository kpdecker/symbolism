import { defineSymbol } from "@symbolism/definitions";
import { getSymbolDeclaration } from "@symbolism/ts-utils";
import { NodeError } from "@symbolism/utils";
import ts from "typescript";
import { AnySchemaNode, convertTSTypeToSchema } from "../schema";
import { SchemaContext } from "../context";
import { convertBinaryExpression } from "./binary-expression";
import { convertObjectLiteralValue } from "./object";
import { convertTemplateLiteralValue } from "./string-template";

export function narrowTypeFromValues(
  type: ts.Type,
  context: SchemaContext
): AnySchemaNode | undefined {
  const { contextNode, checker } = context;

  const symbol = type.getSymbol();
  const symbolDeclaration = getSymbolDeclaration(symbol);

  if (symbolDeclaration) {
    const symbolSchema = convertValueDeclaration(
      ...context.cloneNode(symbolDeclaration)
    );
    if (symbolSchema) {
      return symbolSchema;
    }
  }

  if (contextNode) {
    // If we are using the context node, we will need to resolve where it lives.
    const contextDefinition = defineSymbol(contextNode, checker);
    if (contextDefinition?.declaration) {
      const contextSchema = convertValueDeclaration(
        ...context.cloneNode(contextDefinition.declaration)
      );
      if (contextSchema) {
        return contextSchema;
      }
    }

    const contextSchema = convertValueExpression(
      ...context.cloneNode(contextNode as ts.Expression)
    );
    if (contextSchema) {
      return contextSchema;
    }
  }
}

export function convertValueDeclaration(
  node: ts.Declaration,
  context: SchemaContext
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
        return convertValueExpression(...context.cloneNode(node.initializer));
      }
    }
    if (ts.isExpressionStatement(node)) {
      return convertValueExpression(...context.cloneNode(node.expression));
    }
    if (ts.isTypeAliasDeclaration(node)) {
      const secondDefinition = defineSymbol(node.type, context.checker);
      const secondDeclaration = getSymbolDeclaration(secondDefinition?.symbol);

      if (secondDeclaration) {
        return convertValueDeclaration(...context.cloneNode(secondDeclaration));
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
  context: SchemaContext
): AnySchemaNode | undefined {
  try {
    const { checker } = context;

    if (ts.isParenthesizedExpression(node)) {
      return convertValueExpression(...context.cloneNode(node.expression));
    }

    if (ts.isIdentifier(node)) {
      const identifierDefinition = defineSymbol(node, checker);
      const identifierDeclaration = getSymbolDeclaration(
        identifierDefinition?.symbol
      );

      if (identifierDeclaration) {
        return convertValueDeclaration(
          ...context.cloneNode(identifierDeclaration)
        );
      }
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
      return convertValueExpression(...context.cloneNode(node.expression));
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

  const definition = defineSymbol(node, checker);

  return definition?.declaration && definition?.type
    ? convertTSTypeToSchema(...context.clone(definition.type, node))
    : convertTSTypeToSchema(...context.clone(undefined, node));
}
