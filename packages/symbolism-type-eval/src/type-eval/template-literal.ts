import ts from "typescript";
import { getTypeSchema } from ".";
import { SchemaContext } from "../context";
import { AnySchemaNode, LiteralSchema } from "../schema";
import { getNodeSchema } from "../value-eval";
import { normalizeTemplateLiteralSchema } from "../value-eval/string-template";

export function convertTemplateLiteralType(
  type: ts.Type,
  context: SchemaContext
): AnySchemaNode | undefined {
  if (type.flags & ts.TypeFlags.TemplateLiteral) {
    let { contextNode } = context;
    if (ts.isIdentifier(contextNode)) {
      contextNode = contextNode.parent;
    }

    if (ts.isTemplateExpression(contextNode)) {
      // Unable to map expressions from type to nodes, so we need our own eval
      return getNodeSchema(contextNode, context);
    }

    // But if we're (presumably) in a type declaration we can (only) use the TypeChecker
    // result.
    const templateType = type as ts.TemplateLiteralType;
    const itemTypes = templateType.texts
      .flatMap((text, i) => {
        const textSchema: LiteralSchema | undefined = text
          ? { kind: "literal", value: text }
          : undefined;

        const itemType = templateType.types[i];
        return [
          textSchema!,
          itemType && getTypeSchema(...context.clone(itemType)),
        ];
      })
      .filter(Boolean);

    return normalizeTemplateLiteralSchema(itemTypes);
  }
}
