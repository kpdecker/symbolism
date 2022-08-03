import ts from "typescript";
import { AnySchemaNode } from "../schema";
import { expandUnions } from "./union";

export function evaluateBinaryExpressionSchema(
  leftSchema: AnySchemaNode,
  rightSchema: AnySchemaNode,
  operatorKind: ts.BinaryOperator
): AnySchemaNode {
  let operator: (a: any, b: any) => any;
  switch (operatorKind) {
    case ts.SyntaxKind.PlusToken:
    case ts.SyntaxKind.PlusEqualsToken:
      operator = (a, b) => a + b;
      break;

    case ts.SyntaxKind.MinusToken:
    case ts.SyntaxKind.MinusEqualsToken:
      operator = (a, b) => a - b;
      break;

    case ts.SyntaxKind.AsteriskAsteriskToken:
    case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
      operator = (a, b) => a ** b;
      break;
    case ts.SyntaxKind.AsteriskToken:
    case ts.SyntaxKind.AsteriskEqualsToken:
      operator = (a, b) => a * b;
      break;
    case ts.SyntaxKind.SlashToken:
    case ts.SyntaxKind.SlashEqualsToken:
      operator = (a, b) => a / b;
      break;
    case ts.SyntaxKind.PercentToken:
    case ts.SyntaxKind.PercentEqualsToken:
      operator = (a, b) => a % b;
      break;
    case ts.SyntaxKind.AmpersandToken:
    case ts.SyntaxKind.AmpersandEqualsToken:
      operator = (a, b) => a & b;
      break;
    case ts.SyntaxKind.BarToken:
    case ts.SyntaxKind.BarEqualsToken:
      operator = (a, b) => a | b;
      break;
    case ts.SyntaxKind.CaretToken:
    case ts.SyntaxKind.CaretEqualsToken:
      operator = (a, b) => a ^ b;
      break;
    //
    case ts.SyntaxKind.LessThanLessThanToken:
    case ts.SyntaxKind.LessThanLessThanEqualsToken:
      operator = (a, b) => a << b;
      break;
    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
      operator = (a, b) => a >>> b;
      break;
    case ts.SyntaxKind.GreaterThanGreaterThanToken:
    case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
      operator = (a, b) => a >> b;
      break;
  }

  const expandedSchema = expandUnions({
    items: [leftSchema, rightSchema],
    merger(right, left) {
      if (left.kind === "literal" && right.kind === "literal") {
        return {
          kind: "literal",
          value: operator(left.value, right.value),
        };
      }
    },
  }).map((itemSet): AnySchemaNode => {
    if (itemSet.length === 1) {
      return itemSet[0];
    }
    console.log("itemSet", itemSet);
    return {
      kind: "binary-expression",
      operator: operatorKind,
      items: itemSet,
    };
  });

  if (expandedSchema.length === 1) {
    return expandedSchema[0];
  }

  return {
    kind: "union",
    items: expandedSchema,
  };
}

export function binaryExpressionOperatorToken(operatorKind: ts.BinaryOperator) {
  switch (operatorKind) {
    case ts.SyntaxKind.PlusToken:
    case ts.SyntaxKind.PlusEqualsToken:
      return "+";

    case ts.SyntaxKind.MinusToken:
    case ts.SyntaxKind.MinusEqualsToken:
      return "-";

    case ts.SyntaxKind.AsteriskAsteriskToken:
    case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
      return "**";
    case ts.SyntaxKind.AsteriskToken:
    case ts.SyntaxKind.AsteriskEqualsToken:
      return "*";
    case ts.SyntaxKind.SlashToken:
    case ts.SyntaxKind.SlashEqualsToken:
      return "/";
    case ts.SyntaxKind.PercentToken:
    case ts.SyntaxKind.PercentEqualsToken:
      return "%";
    case ts.SyntaxKind.AmpersandToken:
    case ts.SyntaxKind.AmpersandEqualsToken:
      return "&";
    case ts.SyntaxKind.BarToken:
    case ts.SyntaxKind.BarEqualsToken:
      return "|";
    case ts.SyntaxKind.CaretToken:
    case ts.SyntaxKind.CaretEqualsToken:
      return "^";
    //
    case ts.SyntaxKind.LessThanLessThanToken:
    case ts.SyntaxKind.LessThanLessThanEqualsToken:
      return "<<";
    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
      return ">>>";
    case ts.SyntaxKind.GreaterThanGreaterThanToken:
    case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
      return ">>";

    default:
      throw new Error(`Unsupported binary operator: ${operatorKind}`);
  }
}
