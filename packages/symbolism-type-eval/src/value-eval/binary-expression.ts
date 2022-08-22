import ts from "typescript";
import invariant from "tiny-invariant";

import { isConcreteSchema } from "../classify";
import { AnySchemaNode } from "../schema";
import { SchemaContext } from "../context";
import { booleanPrimitiveSchema } from "../well-known-schemas";

import { getNodeSchema } from ".";
import { normalizeTemplateLiteralSchema } from "./string-template";
import { createUnionKind, expandUnions } from "./union";

export function convertBinaryExpression(
  node: ts.Node,
  context: SchemaContext
): AnySchemaNode | undefined {
  if (!ts.isBinaryExpression(node)) {
    return undefined;
  }

  const leftSchema = getNodeSchema(
    ...context.cloneNode({ node: node.left, decrementDepth: true })
  )!;
  invariant(leftSchema, "Expected left schema");

  const rightSchema = getNodeSchema(
    ...context.cloneNode({ node: node.right, decrementDepth: true })
  )!;
  invariant(rightSchema, "Expected right schema");

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
      return convertArithmeticOperation();

    case ts.SyntaxKind.InKeyword:
    case ts.SyntaxKind.InstanceOfKeyword:
      return booleanPrimitiveSchema;

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
      return convertArithmeticOperation();

    case ts.SyntaxKind.QuestionQuestionToken:
      if (isConcreteSchema(leftSchema)) {
        if (leftSchema.kind === "literal" && leftSchema.value == null) {
          return rightSchema;
        }
        return leftSchema;
      }
      return createUnionKind([leftSchema, rightSchema]);
    case ts.SyntaxKind.AmpersandAmpersandToken:
    case ts.SyntaxKind.BarBarToken:
    case ts.SyntaxKind.AmpersandAmpersandEqualsToken:
    case ts.SyntaxKind.BarBarEqualsToken:
    case ts.SyntaxKind.QuestionQuestionEqualsToken:
      return convertArithmeticOperation();

    case ts.SyntaxKind.EqualsToken:
    case ts.SyntaxKind.CommaToken:
      return getNodeSchema(
        ...context.cloneNode({
          node: node.right,
          decrementDepth: true,
          allowMissing: false,
        })
      );

    default:
      const defaultAssertion: never = operator;
      /* istanbul ignore next */
      throw new Error(`Unhandled operator: ${ts.SyntaxKind[operator]}`);
  }

  function convertArithmeticOperation() {
    return evaluateBinaryExpressionSchema(leftSchema, rightSchema, operator);
  }
}

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

    case ts.SyntaxKind.EqualsEqualsToken:
      operator = (a, b) => a == b;
      break;
    case ts.SyntaxKind.EqualsEqualsEqualsToken:
      operator = (a, b) => a === b;
      break;
    case ts.SyntaxKind.ExclamationEqualsToken:
      operator = (a, b) => a != b;
      break;
    case ts.SyntaxKind.ExclamationEqualsEqualsToken:
      operator = (a, b) => a !== b;
      break;
    case ts.SyntaxKind.GreaterThanToken:
      operator = (a, b) => a > b;
      break;
    case ts.SyntaxKind.GreaterThanEqualsToken:
      operator = (a, b) => a >= b;
      break;
    case ts.SyntaxKind.LessThanToken:
      operator = (a, b) => a < b;
      break;
    case ts.SyntaxKind.LessThanEqualsToken:
      operator = (a, b) => a <= b;
      break;

    case ts.SyntaxKind.BarBarToken:
      operator = (a, b) => a || b;
      break;
    case ts.SyntaxKind.AmpersandAmpersandToken:
      operator = (a, b) => a && b;
      break;

    default:
      /* istanbul ignore next */
      throw new Error(
        `Unsupported binary operator: ${ts.SyntaxKind[operatorKind]}`
      );
  }

  const isAddition =
    operatorKind === ts.SyntaxKind.PlusToken ||
    operatorKind === ts.SyntaxKind.PlusEqualsToken;

  const expandedSchema = expandUnions({
    items: [leftSchema, rightSchema],
    merger(right, left) {
      if (left.kind === "literal" && right.kind === "literal") {
        return {
          kind: "literal",
          value: operator(left.value, right.value),
        };
      } else if (
        isAddition &&
        ((left.kind === "literal" && typeof left.value === "string") ||
          (right.kind === "literal" && typeof right.value === "string"))
      ) {
        // Convert to template type. Note that we do this only for strings
        // because template literals can fully describe abstract strings.
        return normalizeTemplateLiteralSchema([left, right]);
      }
    },
  }).map((itemSet): AnySchemaNode => {
    if (itemSet.length === 1) {
      return itemSet[0];
    }
    return {
      kind: "binary-expression",
      operator: operatorKind,
      items: itemSet,
    };
  });

  return createUnionKind(expandedSchema);
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

    case ts.SyntaxKind.EqualsEqualsToken:
      return "==";
    case ts.SyntaxKind.EqualsEqualsEqualsToken:
      return "===";
    case ts.SyntaxKind.ExclamationEqualsToken:
      return "!=";
    case ts.SyntaxKind.ExclamationEqualsEqualsToken:
      return "!==";

    case ts.SyntaxKind.GreaterThanToken:
      return ">";
    case ts.SyntaxKind.GreaterThanEqualsToken:
      return ">=";
    case ts.SyntaxKind.LessThanToken:
      return "<";
    case ts.SyntaxKind.LessThanEqualsToken:
      return "<=";

    case ts.SyntaxKind.BarBarToken:
      return "||";
    case ts.SyntaxKind.AmpersandAmpersandToken:
      return "&&";

    default:
      throw new Error(
        `Unsupported binary operator: ${ts.SyntaxKind[operatorKind]}`
      );
  }
}
