import invariant from "tiny-invariant";
import ts from "typescript";
import { AnySchemaNode, UnionSchema } from "../schema";

export function expandSchemaList({
  items,
  merger,
  finalizer,
}: {
  items: AnySchemaNode[];
  merger: (
    item: AnySchemaNode,
    priorItem: AnySchemaNode
  ) => AnySchemaNode | undefined;
  finalizer: (itemSet: AnySchemaNode[]) => AnySchemaNode;
}): AnySchemaNode[] {
  const unionIndexes = items
    .map((item, index) => (item.kind === "union" ? index : -1))
    .filter((index) => index >= 0);

  let unionExpansion = [items];
  for (const index of unionIndexes) {
    const union = items[index];
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

      const merged = merger(item, priorItem);

      if (merged) {
        finalItems[finalItems.length - 1] = merged;
      } else {
        finalItems.push(item);
      }
    }

    if (finalItems.length === 1) {
      return finalItems[0];
    }

    return finalizer(finalItems);
  });

  return unionSchemas;
}
