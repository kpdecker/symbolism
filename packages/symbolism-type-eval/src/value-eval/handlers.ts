import { NodeError } from "@symbolism/utils";
import invariant from "tiny-invariant";
import ts from "typescript";
import { getNodeSchema } from ".";
import { SchemaContext } from "../context";
import { AnySchemaNode } from "../schema";
import { getTypeSchema } from "../type-eval";
import { neverSchema } from "../well-known-schemas";

export type NodeEvalHandler = (
  node: ts.Node,
  context: SchemaContext
) => AnySchemaNode | undefined;

export function nodeEvalHandler<T extends { [kind: number]: NodeEvalHandler }>(
  cfg: T
) {
  return cfg;
}

export const checkerEval: NodeEvalHandler = (node, context) => {
  return getTypeSchema(...context.clone(undefined, node));
};

export const noType: NodeEvalHandler = () => undefined;

export const expressionEval: NodeEvalHandler = (node, context) => {
  if ("expression" in node) {
    return getNodeSchema((node as any).expression, context);
  }
  throw new NodeError("Expected expression", node, context.checker);
};

export function variableLike(
  node: ts.Node,
  context: SchemaContext
): AnySchemaNode | undefined {
  invariant(
    ts.isVariableDeclaration(node) ||
      ts.isParameter(node) ||
      ts.isBindingElement(node) ||
      ts.isPropertyDeclaration(node) ||
      ts.isPropertyAssignment(node)
  );

  if (ts.isBindingElement(node)) {
    const schema = getNodeSchema(...context.cloneNode(node.parent));

    const propertyName = ts.isArrayBindingPattern(node.parent)
      ? node.parent.elements.indexOf(node) + ""
      : (node.propertyName || node.name).getText();

    if (schema?.kind === "array") {
      return schema.items;
    } else if (schema?.kind === "tuple") {
      return schema.items[propertyName as any];
    } else if (schema?.kind === "object") {
      return schema.properties[propertyName];
    } else {
      return neverSchema;
    }
  }
  if (node.initializer) {
    return getNodeSchema(...context.cloneNode(node.initializer));
  }
  if (!context.options.limitToValues && "type" in node && node.type) {
    return getNodeSchema(...context.cloneNode(node.type));
  }

  return {
    kind: "primitive",
    name: "unknown",
    node,
  };
}
