import ts from "typescript";
import { invariantNode } from "@noom-symbolism/ts-utils";
import { nodeEvalHandler } from "./handlers";
import { getNodeSchema } from ".";
import { booleanPrimitiveSchema } from "../well-known-schemas";
import { AnySchemaNode } from "../schema";
import { createUnionKind } from "./union";
import invariant from "tiny-invariant";
import { assertUnreachable } from "@noom-symbolism/utils";

export const unaryExpressionOperators = nodeEvalHandler(() => ({
  [ts.SyntaxKind.PrefixUnaryExpression](node, context): AnySchemaNode {
    invariantNode(node, context.checker, ts.isPrefixUnaryExpression);

    const operandSchema = context.resolveSchema(
      getNodeSchema({ context, node: node.operand, decrementDepth: true })
    );
    invariant(operandSchema, "Expected operand to have a schema");
    return evalUnaryOperator(node.operator, operandSchema, node);
  },
  [ts.SyntaxKind.PostfixUnaryExpression](node, context): AnySchemaNode {
    invariantNode(node, context.checker, ts.isPostfixUnaryExpression);

    const schema = getNodeSchema({
      context,
      node: node.operand,
      decrementDepth: true,
    });
    invariant(schema, "Expected operand to have a schema");
    return schema;
  },
}));

function evalUnaryOperator(
  operator: ts.PrefixUnaryOperator | ts.PostfixUnaryOperator,
  operandSchema: AnySchemaNode,
  contextNode: ts.Node
): AnySchemaNode {
  if (operandSchema.kind === "literal") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value: any = operandSchema.value;
    switch (operator) {
      case ts.SyntaxKind.PlusToken:
        return {
          kind: "literal",
          value: +value,
        };
      case ts.SyntaxKind.MinusToken:
        return {
          kind: "literal",
          value: -value,
        };
      case ts.SyntaxKind.TildeToken:
        return {
          kind: "literal",
          value: ~value,
        };
      case ts.SyntaxKind.ExclamationToken:
        return {
          kind: "literal",
          value: !value,
        };
      case ts.SyntaxKind.PlusPlusToken:
        return {
          kind: "literal",
          value: 1 + parseInt(value, 10),
        };
      case ts.SyntaxKind.MinusMinusToken:
        return {
          kind: "literal",
          value: 1 - parseInt(value, 10),
        };
      default:
        assertUnreachable(operator);
    }
  } else if (operandSchema?.kind === "union") {
    return createUnionKind(
      operandSchema.items.map((item) =>
        evalUnaryOperator(operator, item, contextNode)
      )
    );
  } else if (operandSchema?.kind === "intersection") {
    return {
      kind: "intersection",
      items: operandSchema.items.map((item) =>
        evalUnaryOperator(operator, item, contextNode)
      ),
    };
  } else if (
    operandSchema.kind === "primitive" &&
    operandSchema.name === "never"
  ) {
    return {
      kind: "literal",
      value: false,
    };
  }

  if (operator === ts.SyntaxKind.ExclamationToken) {
    return booleanPrimitiveSchema;
  }

  if (
    operandSchema.kind === "object" ||
    operandSchema.kind === "array" ||
    operandSchema.kind === "tuple" ||
    operandSchema.kind === "function"
  ) {
    return {
      kind: "literal",
      value: NaN,
    };
  }

  return {
    kind: "primitive",
    name: "number",
    node: operandSchema.node || contextNode,
  };
}
