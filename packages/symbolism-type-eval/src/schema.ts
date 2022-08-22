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
  typeName: string;
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
  const root = getNodeSchema(node, context);
  return filterDefs({
    defs: context.typeDefinitions,
    root,
  });
}

function filterDefs(schema: Schema) {
  const referenceCount: Record<string, number> = {};

  let { defs, root } = schema;

  defs?.forEach((def) => {
    findReferences(def);
  });

  findReferences(schema.root);

  Array.from(defs?.entries() || []).forEach(([name, def]) => {
    if (referenceCount[name] <= 1 && areSchemasEqual(def, root)) {
      // If we have a direct reference to the root, remove it
      defs?.delete(name);
    } else if (!referenceCount[name]) {
      defs?.delete(name);
    }
  });

  if (root?.kind === "reference") {
    if (referenceCount[root.typeName] === 1) {
      const { typeName } = root;
      root = defs?.get(typeName) || root;
      defs?.delete(typeName);
    }
  }

  return {
    defs,
    root: root && inlineReferences(root),
  };

  function findReferences(schema: AnySchemaNode | undefined) {
    if (!schema) {
      return;
    }

    switch (schema.kind) {
      case "error":
      case "primitive":
      case "literal":
        return;
      case "array":
        findReferences(schema.items);
        return;
      case "object":
        Object.values(schema.properties).forEach(findReferences);
        schema.abstractIndexKeys.forEach(({ key, value }) => {
          findReferences(key);
          findReferences(value);
        });
        return;
      case "function":
        schema.parameters.forEach(({ schema }) => {
          findReferences(schema);
        });
        findReferences(schema.returnType);
        return;
      case "index":
        findReferences(schema.type);
        return;
      case "index-access":
        findReferences(schema.object);
        findReferences(schema.index);
        return;

      case "binary-expression":
      case "template-literal":
      case "tuple":
      case "union":
      case "intersection":
        schema.items.map(findReferences);
        return;
      case "reference":
        referenceCount[schema.typeName] ||= 0;
        referenceCount[schema.typeName]++;
        return;

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
        if (referenceCount[schema.typeName] < 2) {
          const ret = defs?.get(schema.typeName);
          if (ret) {
            defs?.delete(schema.typeName);

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
  typeName: string
): AnySchemaNode | undefined {
  if (!Object.values(ts.InternalSymbolName).includes(name as any)) {
    return {
      kind: "reference",
      name,
      parameters,
      typeName,
    };
  }
}
