import ts from "typescript";
import { convertValueExpression, TypeEvalOptions } from ".";
import { removeDuplicateSchemas } from "../classify";
import { SchemaContext } from "../context";
import { AnySchemaNode } from "../schema";

export function convertArrayLiteralValue(
  node: ts.ArrayLiteralExpression,
  context: SchemaContext
): AnySchemaNode {
  const elements = removeDuplicateSchemas<AnySchemaNode>(
    node.elements.map(
      (element) =>
        convertValueExpression(
          ...context.cloneNode(element, { allowMissing: false })
        )!
    )
  );

  let items: AnySchemaNode;
  if (elements.length === 1) {
    items = elements[0];
  } else {
    items = {
      kind: "union",
      items: elements,
    };
  }

  return {
    kind: "array",
    items,
  };
}
