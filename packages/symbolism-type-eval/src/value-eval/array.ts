import ts from "typescript";
import { removeDuplicateSchemas } from "../classify";
import { SchemaContext } from "../context";
import { AnySchemaNode } from "../schema";
import { getNodeSchema } from ".";
import { createUnionKind } from "./union";
import { nodeEvalHandler } from "./handlers";
import { invariantNode } from "@symbolism/ts-utils";
import { dumpNode } from "@symbolism/ts-debug";

export const arrayOperators = nodeEvalHandler(() => ({
  [ts.SyntaxKind.ArrayLiteralExpression](node, context) {
    invariantNode(node, context.checker, ts.isArrayLiteralExpression);
    return convertArrayLiteralValue(node, context);
  },
  [ts.SyntaxKind.ArrayBindingPattern](node, context) {
    invariantNode(node, context.checker, ts.isArrayBindingPattern);
    return getNodeSchema({ context, node: node.parent, decrementDepth: false });
  },
  [ts.SyntaxKind.SpreadElement](node, context) {
    invariantNode(node, context.checker, ts.isSpreadElement);
    return getNodeSchema({
      context,
      node: node.expression,
      decrementDepth: false,
    });
  },
}));

export function convertArrayLiteralValue(
  node: ts.ArrayLiteralExpression,
  context: SchemaContext
): AnySchemaNode {
  const elements = removeDuplicateSchemas<AnySchemaNode>(
    node.elements.flatMap((element) => {
      const elementSchema = getNodeSchema({
        context,
        node: element,
        decrementDepth: true,
        allowMissing: false,
      })!;

      const dereferencedSchema = context.resolveSchema(elementSchema);
      if (ts.isSpreadElement(element) && dereferencedSchema.kind === "array") {
        return dereferencedSchema.items;
      }

      return elementSchema;
    })
  );

  const items: AnySchemaNode = elements.length
    ? createUnionKind(elements)
    : { kind: "primitive", name: "any" };

  return {
    kind: "array",
    items,
    node,
  };
}
