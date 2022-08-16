import invariant from "tiny-invariant";
import { removeDuplicateSchemas } from "../classify";
import { AnySchemaNode, UnionSchema } from "../schema";

export function expandSchemaList({
  items,
  merger,
  finalizer = (items) => ({
    kind: "union",
    items,
  }),
}: {
  items: AnySchemaNode[];
  merger: (
    item: AnySchemaNode,
    priorItem: AnySchemaNode
  ) => AnySchemaNode | undefined;
  finalizer?: (itemSet: AnySchemaNode[]) => AnySchemaNode;
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

      const merged = item && priorItem && merger(item, priorItem);

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

export function expandUnions({
  items,
  merger,
}: {
  items: AnySchemaNode[];
  merger: (
    item: AnySchemaNode,
    priorItem: AnySchemaNode
  ) => AnySchemaNode | undefined;
}): AnySchemaNode[][] {
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

  const unionSchemas = unionExpansion.map((items): AnySchemaNode[] => {
    const finalItems: AnySchemaNode[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const priorItem = finalItems[finalItems.length - 1];

      const merged = item && priorItem && merger(item, priorItem);

      if (merged) {
        finalItems[finalItems.length - 1] = merged;
      } else {
        finalItems.push(item);
      }
    }

    return finalItems;
  });

  // Filter identical items
  return removeDuplicateSchemas(unionSchemas);
}

export function unionSchemas(
  priorValue: AnySchemaNode | undefined,
  newValue: AnySchemaNode
): AnySchemaNode {
  if (!priorValue) {
    return newValue;
  }
  if (priorValue.kind === "union") {
    return {
      kind: "union",
      items: [...priorValue.items, newValue],
    };
  }
  return {
    kind: "union",
    items: [priorValue, newValue],
  };
}

export function unionProperties(schema: UnionSchema) {
  const properties = {} as { [key: string]: AnySchemaNode };
  for (const item of schema.items) {
    if (item.kind === "object") {
      for (const key of Object.keys(item.properties)) {
        const existingKey = properties[key];
        if (existingKey) {
          if (existingKey.kind === "union") {
            existingKey.items.push(item.properties[key]);
          } else {
            properties[key] = {
              kind: "union",
              items: [existingKey, item.properties[key]],
            };
          }
        } else {
          properties[key] = item.properties[key];
        }
      }
    }
  }
  return properties;
}
