import ts from "typescript";
import { removeDuplicateSchemas } from "../classify";
import { SchemaContext } from "../context";
import { AnySchemaNode } from "../schema";
import { getNodeSchema } from ".";
import { createUnionKind } from "./union";
import { nodeEvalHandler } from "./handlers";
import { invariantNode } from "@symbolism/ts-utils";
import { dumpNode } from "@symbolism/ts-debug";

export const arrayOperators = nodeEvalHandler({
  [ts.SyntaxKind.ArrayLiteralExpression](node, context) {
    invariantNode(node, context.checker, ts.isArrayLiteralExpression);
    return convertArrayLiteralValue(node, context);
  },
  [ts.SyntaxKind.ArrayBindingPattern](node, context) {
    invariantNode(node, context.checker, ts.isArrayBindingPattern);
    return getNodeSchema(
      ...context.cloneNode({
        node: node.parent,
        decrementDepth: false,
      })
    );
  },
});

export function convertArrayLiteralValue(
  node: ts.ArrayLiteralExpression,
  context: SchemaContext
): AnySchemaNode {
  const elements = removeDuplicateSchemas<AnySchemaNode>(
    node.elements.map(
      (element) =>
        getNodeSchema(
          ...context.cloneNode({
            node: element,
            decrementDepth: true,
            allowMissing: false,
          })
        )!
    )
  );

  const items = createUnionKind(elements);

  return {
    kind: "array",
    items,
  };
}
