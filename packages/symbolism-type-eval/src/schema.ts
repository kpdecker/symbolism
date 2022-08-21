import ts from "typescript";
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
  defs?: Map<ts.Symbol, AnySchemaNode>;
  root: AnySchemaNode | undefined;
};

export function evaluateSchema(node: ts.Node, checker: ts.TypeChecker): Schema {
  const context = new SchemaContext(node, checker, {});
  const root = getNodeSchema(node, context);
  return {
    defs: context.symbolDefinitions,
    root,
  };
}

export function createReferenceSchema(
  name: string,
  parameters: ReferenceSchema["parameters"]
): AnySchemaNode | undefined {
  if (!Object.values(ts.InternalSymbolName).includes(name as any)) {
    return {
      kind: "reference",
      name,
      parameters,
    };
  }
}
