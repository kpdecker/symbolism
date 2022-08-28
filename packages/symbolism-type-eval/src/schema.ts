import { TypeId } from "@symbolism/ts-utils";
import ts from "typescript";
import { areSchemasEqual } from "./classify";
import { SchemaContext } from "./context";
import { getNodeSchema } from "./value-eval";

interface SchemaNode {
  flags?: string[];
  extra?: any;
}

export interface PrimitiveSchema extends SchemaNode {
  kind: "primitive";
  name: // JS
  | "string"
    | "number"
    | "boolean"
    | "bigint"
    | "symbol"

    // Extended JS
    | "symbol"

    // TS
    | "object"
    | "unknown"
    | "any"
    | "never";
  node: ts.Node;
}

export interface UnionSchema extends SchemaNode {
  kind: "union";
  items: AnySchemaNode[];
}

export interface IntersectionSchema extends SchemaNode {
  kind: "intersection";
  items: AnySchemaNode[];
}

export interface TemplateLiteralSchema extends SchemaNode {
  kind: "template-literal";
  items: AnySchemaNode[];
}

export interface LiteralSchema extends SchemaNode {
  kind: "literal";
  value: boolean | string | number | bigint | undefined | null;
}

export interface ObjectSchema extends SchemaNode {
  kind: "object";
  properties: { [key: string]: AnySchemaNode };

  // Computed properties that are not fully resolved
  abstractIndexKeys: { key: AnySchemaNode; value: AnySchemaNode }[];
}
export interface ArraySchema extends SchemaNode {
  kind: "array";
  items: AnySchemaNode;
}
export interface TupleSchema extends SchemaNode {
  kind: "tuple";
  items: AnySchemaNode[];
  elementFlags: readonly ts.ElementFlags[];
}

export interface FunctionSchema extends SchemaNode {
  kind: "function";
  parameters: {
    name: string;
    schema: AnySchemaNode;
    symbol: ts.Symbol | undefined;
  }[];
  returnType: AnySchemaNode;
}

export interface BinaryExpressionSchema extends SchemaNode {
  kind: "binary-expression";
  operator: ts.BinaryOperator;
  items: AnySchemaNode[];
}

export interface IndexSchema extends SchemaNode {
  kind: "index";
  type: AnySchemaNode;
  node: ts.Node;
}

export interface IndexAccessSchema extends SchemaNode {
  kind: "index-access";
  object: AnySchemaNode;
  index: AnySchemaNode;
  node: ts.Node;
}

export interface ReferenceSchema extends SchemaNode {
  kind: "reference";
  name: string;
  parameters: AnySchemaNode[];

  // Fully resolved type name, per typescript. This is used to
  // track resolves types for generics.
  typeId: TypeId;
}

export interface ErrorSchema extends SchemaNode {
  kind: "error";
  node?: ts.Node;
}

export type AnySchemaNode =
  | PrimitiveSchema
  | UnionSchema
  | IntersectionSchema
  | LiteralSchema
  | TemplateLiteralSchema
  | ObjectSchema
  | ArraySchema
  | TupleSchema
  | IndexSchema
  | IndexAccessSchema
  | FunctionSchema
  | BinaryExpressionSchema
  | ReferenceSchema
  | ErrorSchema;

export type Schema = {
  defs?: Map<string, AnySchemaNode>;
  root: AnySchemaNode | undefined;
};

export function evaluateSchema(node: ts.Node, checker: ts.TypeChecker): Schema {
  const context = new SchemaContext(node, checker, {});
  const root = getNodeSchema({ context, node, decrementDepth: false });
  return filterDefs({
    defs: context.typeDefinitions,
    root,
  });
}

function filterDefs(schema: Schema) {
  const referenceCount: Record<string, number> = {};

  let { defs, root } = schema;

  const referencesToCount = new Set(findReferences(schema.root));

  for (const name of referencesToCount) {
    const def = defs?.get(name);

    const foundReferences = findReferences(def);
    for (const reference of foundReferences) {
      // If a new value is added, it will be appended to our iterator
      // if one exists already, then this is a NOP operation for both the
      // set and the iterator.
      referencesToCount.add(reference);
    }
  }

  Array.from(defs?.entries() || []).forEach(([name, def]) => {
    if (def.kind === "error") {
      defs?.delete(name);
    }
    if (referenceCount[name] <= 1 && areSchemasEqual(def, root)) {
      // If we have a direct reference to the root, remove it
      defs?.delete(name);
    } else if (!referenceCount[name]) {
      defs?.delete(name);
    }
  });

  if (root?.kind === "reference") {
    if (referenceCount[root.typeId] === 1) {
      const { typeId } = root;
      root = defs?.get(typeId) || root;
      defs?.delete(typeId);
    }
  }

  return {
    defs,
    root: root && inlineReferences(root),
  };

  function findReferences(schema: AnySchemaNode | undefined): string[] {
    if (!schema) {
      return [];
    }

    switch (schema.kind) {
      case "error":
      case "primitive":
      case "literal":
        return [];
      case "array":
        return findReferences(schema.items);
      case "object": {
        const propertyReferences = Object.values(schema.properties).flatMap(
          findReferences
        );
        const indexReferences = schema.abstractIndexKeys.flatMap(
          ({ key, value }) => {
            return findReferences(key).concat(findReferences(value));
          }
        );
        return propertyReferences.concat(indexReferences);
      }
      case "function": {
        const parameterReferences = schema.parameters.flatMap(({ schema }) =>
          findReferences(schema)
        );
        const returnReferences = findReferences(schema.returnType);
        return parameterReferences.concat(returnReferences);
      }
      case "index":
        return findReferences(schema.type);
      case "index-access": {
        const objectReferences = findReferences(schema.object);
        const indexReferences = findReferences(schema.index);
        return objectReferences.concat(indexReferences);
      }

      case "binary-expression":
      case "template-literal":
      case "tuple":
      case "union":
      case "intersection":
        return schema.items.flatMap(findReferences);
      case "reference":
        referenceCount[schema.typeId] ||= 0;
        referenceCount[schema.typeId]++;
        return [schema.typeId];

      default:
        const gottaCatchEmAll: never = schema;
        throw new Error(`Unsupported schema kind ${(schema as any).kind}`);
    }
  }

  function inlineReferences(schema: AnySchemaNode): AnySchemaNode {
    switch (schema.kind) {
      case "error":
      case "primitive":
      case "literal":
        return schema;
      case "array":
        return {
          ...schema,
          items: inlineReferences(schema.items),
        };
      case "object":
        return {
          ...schema,
          properties: Object.fromEntries(
            Object.entries(schema.properties).map(([key, value]) => [
              key,
              inlineReferences(value),
            ])
          ),
          abstractIndexKeys: schema.abstractIndexKeys.map(({ key, value }) => ({
            key: inlineReferences(key),
            value: inlineReferences(value),
          })),
        };
      case "function":
        return {
          ...schema,
          parameters: schema.parameters.map((param) => ({
            ...param,
            schema: inlineReferences(param.schema),
          })),
          returnType: inlineReferences(schema.returnType),
        };
      case "index":
        return {
          ...schema,
          type: inlineReferences(schema.type),
        };
      case "index-access":
        return {
          ...schema,
          object: inlineReferences(schema.object),
          index: inlineReferences(schema.index),
        };

      case "binary-expression":
      case "template-literal":
      case "tuple":
      case "union":
      case "intersection":
        return {
          ...schema,
          items: schema.items.map(inlineReferences),
        };
      case "reference":
        if (referenceCount[schema.typeId] < 2) {
          const ret = defs?.get(schema.typeId);
          if (ret) {
            defs?.delete(schema.typeId);

            return ret;
          }
        }
        return schema;

      default:
        const gottaCatchEmAll: never = schema;
        throw new Error(`Unsupported schema kind ${(schema as any).kind}`);
    }
  }
}

export function createReferenceSchema(
  name: string,
  parameters: ReferenceSchema["parameters"],
  typeId: TypeId
): AnySchemaNode {
  return {
    kind: "reference",
    name,
    parameters,
    typeId,
  };
}
