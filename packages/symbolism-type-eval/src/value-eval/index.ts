import { defineSymbol } from "@symbolism/definitions";
import { getSymbolDeclaration } from "@symbolism/ts-utils";
import ts from "typescript";
import { AnySchemaNode, convertTSTypeToSchema, SchemaContext } from "../schema";
import { evaluateBinaryExpressionSchema } from "./binary-expression";
import { convertTemplateLiteralValue } from "./string-template";
import { expandSchemaList } from "./union";

export function narrowTypeFromValues(
  type: ts.Type,
  context: SchemaContext
): AnySchemaNode | undefined {
  const { contextNode, checker, typesHandled } = context;

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
}

export function convertValueExpression(
  node: ts.Expression,
  context: SchemaContext
): AnySchemaNode | undefined {
  const { checker, typesHandled } = context;

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

  if (ts.isTemplateExpression(node)) {
    return convertTemplateLiteralValue(node, context);
  }

  if (ts.isBinaryExpression(node)) {
    const operator = node.operatorToken.kind as ts.BinaryOperator;
    switch (operator) {
      case ts.SyntaxKind.GreaterThanToken:
      case ts.SyntaxKind.GreaterThanEqualsToken:
      case ts.SyntaxKind.LessThanToken:
      case ts.SyntaxKind.LessThanEqualsToken:
      case ts.SyntaxKind.EqualsEqualsToken:
      case ts.SyntaxKind.EqualsEqualsEqualsToken:
      case ts.SyntaxKind.ExclamationEqualsToken:
      case ts.SyntaxKind.ExclamationEqualsEqualsToken:
      case ts.SyntaxKind.InKeyword:
      case ts.SyntaxKind.InstanceOfKeyword:
        return {
          kind: "primitive",
          name: "boolean",
          node: node,
        };

      case ts.SyntaxKind.PlusToken:
      case ts.SyntaxKind.PlusEqualsToken:
      case ts.SyntaxKind.MinusToken:
      case ts.SyntaxKind.MinusEqualsToken:
      case ts.SyntaxKind.AsteriskAsteriskToken:
      case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
      case ts.SyntaxKind.AsteriskToken:
      case ts.SyntaxKind.AsteriskEqualsToken:
      case ts.SyntaxKind.SlashToken:
      case ts.SyntaxKind.SlashEqualsToken:
      case ts.SyntaxKind.PercentToken:
      case ts.SyntaxKind.PercentEqualsToken:
      case ts.SyntaxKind.AmpersandToken:
      case ts.SyntaxKind.AmpersandEqualsToken:
      case ts.SyntaxKind.BarToken:
      case ts.SyntaxKind.BarEqualsToken:
      case ts.SyntaxKind.CaretToken:
      case ts.SyntaxKind.CaretEqualsToken:
      case ts.SyntaxKind.LessThanLessThanToken:
      case ts.SyntaxKind.LessThanLessThanEqualsToken:
      case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
      case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
      case ts.SyntaxKind.GreaterThanGreaterThanToken:
      case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
        return convertArithmeticOperation(node, operator);

      case ts.SyntaxKind.QuestionQuestionToken:
      case ts.SyntaxKind.AmpersandAmpersandToken:
      case ts.SyntaxKind.BarBarToken:
      case ts.SyntaxKind.AmpersandAmpersandEqualsToken:
      case ts.SyntaxKind.BarBarEqualsToken:
      case ts.SyntaxKind.QuestionQuestionEqualsToken:
        return convertNode(node.right, context);

      case ts.SyntaxKind.EqualsToken:
      case ts.SyntaxKind.CommaToken:
        return convertValueExpression(...context.cloneNode(node.right));

      default:
        const defaultAssertion: never = operator;
        throw new Error(`Unhandled operator: ${ts.SyntaxKind[operator]}`);
    }
  }

  function convertArithmeticOperation(
    node: ts.BinaryExpression,
    operatorKind: ts.BinaryOperator
  ): AnySchemaNode {
    const leftSchema = convertNode(node.left, context);
    const rightSchema = convertNode(node.right, context);

    return evaluateBinaryExpressionSchema(
      leftSchema,
      rightSchema,
      operatorKind
    );
  }

  function convertNode(node: ts.Node, context: SchemaContext) {
    const definition = defineSymbol(node, checker);

    return definition?.declaration && definition?.type
      ? convertTSTypeToSchema(...context.clone(definition.type))
      : convertTSTypeToSchema(
          ...context.clone(checker.getTypeAtLocation(node))
        );
  }
}
