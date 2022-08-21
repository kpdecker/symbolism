import ts from "typescript";
import { invariantNode } from "@symbolism/ts-utils";
import { checkerEval, nodeEvalHandler, noType } from "./handlers";
import { getNodeSchema } from ".";
import { AnySchemaNode, ObjectSchema } from "../schema";
import { SchemaError } from "../classify";

export const jsxPathHandlers = nodeEvalHandler({
  [ts.SyntaxKind.JsxElement](node, context) {
    invariantNode(node, context.checker, ts.isJsxElement);
    return getNodeSchema(...context.cloneNode(node.openingElement));
  },
  [ts.SyntaxKind.JsxOpeningElement](node, context) {
    invariantNode(node, context.checker, ts.isJsxOpeningElement);
    return getNodeSchema(node.tagName, context);
  },
  [ts.SyntaxKind.JsxSelfClosingElement](node, context) {
    invariantNode(node, context.checker, ts.isJsxSelfClosingElement);
    return getNodeSchema(node.tagName, context);
  },
  [ts.SyntaxKind.JsxClosingElement](node, context) {
    invariantNode(node, context.checker, ts.isJsxClosingElement);
    return getNodeSchema(node.tagName, context);
  },

  [ts.SyntaxKind.JsxFragment]: checkerEval,
  [ts.SyntaxKind.JsxOpeningFragment]: noType,
  [ts.SyntaxKind.JsxClosingFragment]: noType,

  [ts.SyntaxKind.JsxText](node, context) {
    invariantNode(node, context.checker, ts.isJsxText);
    return {
      kind: "literal",
      value: node.text,
    };
  },
  [ts.SyntaxKind.JsxTextAllWhiteSpaces]: checkerEval, // Converted to JsxText at parse time
  [ts.SyntaxKind.JsxExpression](node, context) {
    invariantNode(node, context.checker, ts.isJsxExpression);
    if (node.expression) {
      return getNodeSchema(node.expression, context);
    }
  },

  [ts.SyntaxKind.JsxAttributes](node, context) {
    invariantNode(node, context.checker, ts.isJsxAttributes);

    const properties: Record<string, AnySchemaNode> = {};
    const abstractIndexKeys: ObjectSchema["abstractIndexKeys"] = [];

    node.properties.forEach((property) => {
      if (ts.isJsxSpreadAttribute(property)) {
        const spreadSchema = getNodeSchema(property, context);
        if (spreadSchema?.kind === "object") {
          Object.assign(properties, spreadSchema.properties);
          abstractIndexKeys.push(...spreadSchema.abstractIndexKeys);
        } else if (spreadSchema) {
          // TODO: Unions, other schemas
          throw new SchemaError("Expected object", spreadSchema);
        }
      } else {
        invariantNode(property, context.checker, ts.isJsxAttribute);
        properties[property.name.text] = property.initializer
          ? getNodeSchema(property.initializer, context)!
          : { kind: "literal", value: true };
      }
    });
    return {
      kind: "object",
      properties,
      abstractIndexKeys,
    };
  },
  [ts.SyntaxKind.JsxAttribute](node, context) {
    invariantNode(node, context.checker, ts.isJsxAttribute);
    if (node.initializer) {
      return getNodeSchema(...context.cloneNode(node.initializer));
    }
    return checkerEval(node, context);
  },
  [ts.SyntaxKind.JsxSpreadAttribute](node, context) {
    invariantNode(node, context.checker, ts.isJsxSpreadAttribute);
    return getNodeSchema(node.expression, context);
  },
});
