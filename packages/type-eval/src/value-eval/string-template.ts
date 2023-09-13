import { defineSymbol } from "@noom-symbolism/definitions";
import invariant from "tiny-invariant";
import ts from "typescript";
import { isLiteralUnion } from "../classify";
import { AnySchemaNode } from "../schema";
import { SchemaContext } from "../context";
import { createUnionKind, expandSchemaList } from "./union";
import { getNodeSchema } from ".";
import { checkerEval, nodeEvalHandler } from "./handlers";
import { invariantNode } from "@noom-symbolism/ts-utils";

export const templateOperators = nodeEvalHandler(() => ({
  [ts.SyntaxKind.NoSubstitutionTemplateLiteral]: checkerEval,
  [ts.SyntaxKind.TemplateExpression](node, context) {
    invariantNode(node, context.checker, ts.isTemplateExpression);
    return convertTemplateLiteralValue(node, context);
  },
  [ts.SyntaxKind.TemplateHead]: checkerEval,
  [ts.SyntaxKind.TemplateMiddle]: checkerEval,
  [ts.SyntaxKind.TemplateTail]: checkerEval,
  [ts.SyntaxKind.TemplateSpan]: checkerEval,

  [ts.SyntaxKind.TemplateLiteralType]: checkerEval,
  [ts.SyntaxKind.TemplateLiteralTypeSpan]: checkerEval,
}));

export function convertTemplateLiteralValue(
  node: ts.TemplateExpression,
  context: SchemaContext
): AnySchemaNode {
  const { checker } = context;

  const itemTypes: AnySchemaNode[] = [];
  if (node.head.text) {
    itemTypes.push({
      kind: "literal",
      value: node.head.text,
    });
  }

  for (const templateSpan of node.templateSpans) {
    const expressionDefinition = defineSymbol(
      templateSpan.expression,
      checker,
      { chooseLocal: false }
    );

    let expressionSchema: AnySchemaNode | undefined;
    if (expressionDefinition?.declaration) {
      expressionSchema = getNodeSchema({
        context,
        node: expressionDefinition.declaration,
        decrementDepth: false,
      });
    }
    if (!expressionSchema) {
      expressionSchema = getNodeSchema({
        context,
        node: templateSpan.expression,
        decrementDepth: false,
      });
    }
    if (expressionSchema) {
      itemTypes.push(expressionSchema);
    }

    if (templateSpan.literal.text) {
      itemTypes.push({
        kind: "literal",
        value: templateSpan.literal.text,
      });
    }
  }

  return normalizeTemplateLiteralSchema(itemTypes, context);
}

// Normalizes template literal schemas. This will flatten
// the schema as well as pull any unions up.
export function normalizeTemplateLiteralSchema(
  itemTypes: AnySchemaNode[],
  context: SchemaContext
): AnySchemaNode {
  // Flatten anything that we can.
  const unionIndexes: number[] = [];
  const flattenedItems: AnySchemaNode[] = [];
  for (let i = 0; i < itemTypes.length; i++) {
    const item = context.resolveSchema(itemTypes[i]);
    const priorItem = flattenedItems[flattenedItems.length - 1];

    if (item.kind === "literal" && priorItem?.kind === "literal") {
      flattenedItems[flattenedItems.length - 1] = {
        kind: "literal",
        value: "" + priorItem.value + item.value,
      };
    } else if (item.kind === "template-literal") {
      // Flatten literals
      itemTypes.splice(i + 1, 0, ...item.items);
    } else {
      // Record unions for potential expansion
      if (item.kind === "union" && isLiteralUnion(item)) {
        unionIndexes.push(flattenedItems.length);
      }

      flattenedItems.push(item);
    }
  }

  let unionExpansion = [flattenedItems];
  for (const index of unionIndexes) {
    const union = flattenedItems[index];
    invariant(union.kind === "union", "Expected union");

    unionExpansion = union.items.flatMap((item) => {
      return unionExpansion.map((items) => {
        const newItems = [...items];
        newItems.splice(index, 1, item);
        return newItems;
      });
    });
  }

  const expandedSchemas = expandSchemaList({
    items: flattenedItems,
    merger: (item, priorItem) => {
      if (item.kind === "literal" && priorItem?.kind === "literal") {
        return {
          kind: "literal",
          value: "" + priorItem.value + item.value,
        };
      }
      return undefined;
    },
    finalizer: (itemSet) => {
      return {
        kind: "template-literal",
        items: itemSet,
      };
    },
  });

  return createUnionKind(expandedSchemas);
}
