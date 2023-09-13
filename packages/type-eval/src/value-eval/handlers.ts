import { NodeError } from "@noom/symbolism-utils";
import invariant from "tiny-invariant";
import ts from "typescript";
import { getNodeSchema } from ".";
import { findParameterDependency } from "../classify";
import { SchemaContext } from "../context";
import { AnySchemaNode } from "../schema";
import { getTypeSchema } from "../type-eval";
import { neverSchema } from "../well-known-schemas";

export type NodeEvalHandler = (
  node: ts.Node,
  context: SchemaContext
) => AnySchemaNode | undefined;

export function nodeEvalHandler<
  T extends () => { [kind: number]: NodeEvalHandler }
>(cfg: T) {
  return cfg;
}

export const checkerEval: NodeEvalHandler = (node, context) => {
  return getTypeSchema({ context, node, decrementDepth: false });
};

export const noType: NodeEvalHandler = () => undefined;

export const expressionEval: NodeEvalHandler = (node, context) => {
  if ("expression" in node) {
    return getNodeSchema({
      // @ts-expect-error Check above
      node: node.expression,
      context,
      decrementDepth: false,
    });
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
    // Use checker to handle rest declarations
    if (
      node.dotDotDotToken &&
      (ts.isArrayBindingPattern(node.parent) ||
        ts.isObjectBindingPattern(node.parent))
    ) {
      return getTypeSchema({ context, node, decrementDepth: false });
    }

    const schema = context.resolveSchema(
      getNodeSchema({ context, node: node.parent, decrementDepth: false })
    );

    const propertyName = ts.isArrayBindingPattern(node.parent)
      ? node.parent.elements.indexOf(node) + ""
      : (node.propertyName || node.name).getText();

    if (schema?.kind === "array") {
      return schema.items;
    } else if (schema?.kind === "tuple") {
      // @ts-expect-error Using implicit casting
      return schema.items[propertyName];
    } else if (schema?.kind === "object") {
      return schema.properties[propertyName] || neverSchema;
    } else if (schema?.kind === "primitive" && schema.name === "any") {
      return schema;
    } else {
      return neverSchema;
    }
  }
  if (node.initializer) {
    return getNodeSchema({
      context,
      node: node.initializer,
      decrementDepth: false,
    });
  }

  if (context.options.lateBindParameters) {
    const dependency = findParameterDependency(node, context.checker);
    if (dependency) {
      return {
        kind: "primitive",
        name: "unknown",
        node,
      };
    }
  }

  if ("type" in node && node.type) {
    return getNodeSchema({ context, node: node.type, decrementDepth: false });
  }

  return {
    kind: "primitive",
    name: "unknown",
    node,
  };
}

export function remapSchemaNode(
  schema: AnySchemaNode | undefined,
  node: ts.Node
): AnySchemaNode | undefined {
  if (schema?.node) {
    return {
      ...schema,
      node,
    };
  }
  return schema;
}
