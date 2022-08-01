import { defineSymbol } from "@symbolism/definitions";
import invariant from "tiny-invariant";
import ts from "typescript";
import { convertValueDeclaration } from ".";
import { isLiteralUnion } from "../classify";
import { AnySchemaNode, convertTSTypeToSchema } from "../schema";

export function convertTemplateLiteralValue(
  node: ts.TemplateExpression,
  checker: ts.TypeChecker,
  typesHandled: Set<ts.Type>
): AnySchemaNode {
  const itemTypes: AnySchemaNode[] = [];
  if (node.head.text) {
    itemTypes.push({
      kind: "literal",
      value: node.head.text,
    });
  }

  for (const templateSpan of node.templateSpans) {
    const expressionDefinition = defineSymbol(templateSpan.expression, checker);

    let expressionSchema: AnySchemaNode | undefined;
    if (expressionDefinition?.declaration) {
      expressionSchema = convertValueDeclaration(
        expressionDefinition.declaration,
        checker,
        typesHandled
      );
    }
    if (!expressionSchema) {
      // Note creating a new infinite loop context. This may be a mistake.
      expressionSchema = convertTSTypeToSchema(
        checker.getTypeAtLocation(templateSpan.expression),
        templateSpan.expression,
        checker
      );
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

  // Flatten anything that we can.
  const unionIndexes: number[] = [];
  const flattenedItems: AnySchemaNode[] = [];
  for (let i = 0; i < itemTypes.length; i++) {
    const item = itemTypes[i];
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

  const unionSchemas = unionExpansion.map((items): AnySchemaNode => {
    const finalItems: AnySchemaNode[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const priorItem = finalItems[finalItems.length - 1];

      if (item.kind === "literal" && priorItem?.kind === "literal") {
        finalItems[finalItems.length - 1] = {
          kind: "literal",
          value: "" + priorItem.value + item.value,
        };
      } else {
        finalItems.push(item);
      }
    }

    if (finalItems.length === 1) {
      return finalItems[0];
    }

    return {
      kind: "template-literal",
      items: finalItems,
    };
  });

  if (unionSchemas.length === 1) {
    return unionSchemas[0];
  }
  return {
    kind: "union",
    items: unionSchemas,
  };
}
