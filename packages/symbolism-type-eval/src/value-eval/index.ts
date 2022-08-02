import { defineSymbol } from "@symbolism/definitions";
import { getSymbolDeclaration } from "@symbolism/ts-utils";
import ts from "typescript";
import { AnySchemaNode, convertTSTypeToSchema } from "../schema";
import { convertTemplateLiteralValue } from "./string-template";
import { expandSchemaList } from "./union";

export function narrowTypeFromValues(
  type: ts.Type,
  contextNode: ts.Node,
  checker: ts.TypeChecker,
  typesHandled: Set<ts.Type>
): AnySchemaNode | undefined {
  const symbol = type.getSymbol();
  const symbolDeclaration = getSymbolDeclaration(symbol);

  if (symbolDeclaration) {
    const symbolSchema = convertValueDeclaration(
      symbolDeclaration,
      checker,
      typesHandled
    );
    if (symbolSchema) {
      return symbolSchema;
    }
  }

  if (contextNode) {
    const contextSchema = convertValueExpression(
      contextNode as ts.Expression,
      checker,
      typesHandled
    );
    if (contextSchema) {
      return contextSchema;
    }
  }
}

export function convertValueDeclaration(
  node: ts.Declaration,
  checker: ts.TypeChecker,
  typesHandled: Set<ts.Type>
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
      return convertValueExpression(node.initializer, checker, typesHandled);
    }
  }
  if (ts.isExpressionStatement(node)) {
    return convertValueExpression(node.expression, checker, typesHandled);
  }
  if (ts.isTypeAliasDeclaration(node)) {
    const secondDefinition = defineSymbol(node.type, checker);
    const secondDeclaration = getSymbolDeclaration(secondDefinition?.symbol);

    if (secondDeclaration) {
      return convertValueDeclaration(secondDeclaration, checker, typesHandled);
    }
  }
}

export function convertValueExpression(
  node: ts.Expression,
  checker: ts.TypeChecker,
  typesHandled: Set<ts.Type>
): AnySchemaNode | undefined {
  if (ts.isIdentifier(node)) {
    const identifierDefinition = defineSymbol(node, checker);
    const identifierDeclaration = getSymbolDeclaration(
      identifierDefinition?.symbol
    );

    if (identifierDeclaration) {
      return convertValueDeclaration(
        identifierDeclaration,
        checker,
        typesHandled
      );
    }
  }

  if (ts.isTemplateExpression(node)) {
    return convertTemplateLiteralValue(node, checker, typesHandled);
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
        };

      case ts.SyntaxKind.PlusToken:
      case ts.SyntaxKind.PlusEqualsToken:
        return convertArithmeticOperation(node, (a, b) => a + b);

      case ts.SyntaxKind.MinusToken:
      case ts.SyntaxKind.MinusEqualsToken:
        return convertArithmeticOperation(node, (a, b) => a - b);

      case ts.SyntaxKind.AsteriskAsteriskToken:
      case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
        return convertArithmeticOperation(node, (a, b) => a ** b);
      case ts.SyntaxKind.AsteriskToken:
      case ts.SyntaxKind.AsteriskEqualsToken:
        return convertArithmeticOperation(node, (a, b) => a * b);
      case ts.SyntaxKind.SlashToken:
      case ts.SyntaxKind.SlashEqualsToken:
        return convertArithmeticOperation(node, (a, b) => a / b);
      case ts.SyntaxKind.PercentToken:
      case ts.SyntaxKind.PercentEqualsToken:
        return convertArithmeticOperation(node, (a, b) => a % b);
      case ts.SyntaxKind.AmpersandToken:
      case ts.SyntaxKind.AmpersandEqualsToken:
        return convertArithmeticOperation(node, (a, b) => a & b);
      case ts.SyntaxKind.BarToken:
      case ts.SyntaxKind.BarEqualsToken:
        return convertArithmeticOperation(node, (a, b) => a | b);
      case ts.SyntaxKind.CaretToken:
      case ts.SyntaxKind.CaretEqualsToken:
        return convertArithmeticOperation(node, (a, b) => a ^ b);
      //
      case ts.SyntaxKind.LessThanLessThanToken:
      case ts.SyntaxKind.LessThanLessThanEqualsToken:
        return convertArithmeticOperation(node, (a, b) => a << b);
      case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
      case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
        return convertArithmeticOperation(node, (a, b) => a >>> b);
      case ts.SyntaxKind.GreaterThanGreaterThanToken:
      case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
        return convertArithmeticOperation(node, (a, b) => a >> b);

      case ts.SyntaxKind.QuestionQuestionToken:
      case ts.SyntaxKind.AmpersandAmpersandToken:
      case ts.SyntaxKind.BarBarToken:
      case ts.SyntaxKind.AmpersandAmpersandEqualsToken:
      case ts.SyntaxKind.BarBarEqualsToken:
      case ts.SyntaxKind.QuestionQuestionEqualsToken:
        return convertSide(node, "right");

      case ts.SyntaxKind.EqualsToken:
      case ts.SyntaxKind.CommaToken:
        return convertValueExpression(node.right, checker, typesHandled);

      default:
        const defaultAssertion: never = operator;
        throw new Error(`Unhandled operator: ${ts.SyntaxKind[operator]}`);
    }
  }

  function convertArithmeticOperation(
    node: ts.BinaryExpression,
    operator: (a: any, b: any) => any
  ): AnySchemaNode {
    const leftSchema = convertSide(node, "left");
    const rightSchema = convertSide(node, "right");

    const expandedSchema = expandSchemaList({
      items: [leftSchema, rightSchema],
      merger(right, left) {
        if (left.kind === "literal" && right.kind === "literal") {
          return {
            kind: "literal",
            value: operator(left.value, right.value),
          };
        }
      },
      finalizer(schemas) {
        return {
          kind: "union",
          items: schemas,
        };
      },
    });

    if (expandedSchema.length === 1) {
      return expandedSchema[0];
    }

    return {
      kind: "union",
      items: expandedSchema,
    };
  }

  function convertSide(node: ts.BinaryExpression, side: "right" | "left") {
    const definition = defineSymbol(node[side], checker);

    return definition?.declaration && definition?.type
      ? convertTSTypeToSchema(definition.type, definition.declaration, checker)
      : convertTSTypeToSchema(
          checker.getTypeAtLocation(node[side]),
          node,
          checker
        );
  }
}
