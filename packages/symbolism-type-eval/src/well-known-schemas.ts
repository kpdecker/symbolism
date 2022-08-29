import { TypeId } from "@symbolism/ts-utils";
import {
  AnySchemaNode,
  LiteralSchema,
  PrimitiveSchema,
  ReferenceSchema,
  UnionSchema,
} from "./schema";

export const undefinedSchema: LiteralSchema = {
  kind: "literal",
  value: undefined,
};

export const neverSchema: Readonly<PrimitiveSchema> = {
  kind: "primitive",
  name: "never",
  node: undefined,
};

export const booleanPrimitiveSchema: Readonly<UnionSchema> = {
  kind: "union",
  items: [
    { kind: "literal", value: true },
    { kind: "literal", value: false },
  ],
};

export const numberPrimitiveSchema: Readonly<PrimitiveSchema> = {
  kind: "primitive",
  name: "number",
  node: undefined,
};

export const tooMuchRecursionSchema: Readonly<ReferenceSchema> = {
  kind: "reference",
  name: "tooMuchRecursion",
  parameters: [],
  typeId: "tooMuchRecursion" as TypeId,
  friendlyTypeId: "tooMuchRecursion" as TypeId,
};

export const wellKnownReferences = [
  "Array",
  "Boolean",
  "Date",
  "Error",
  "Function",
  "Number",
  "Object",
  "RegExp",
  "RegExpMatchArray",
  "String",
  "Symbol",
  "Promise",
  "WeakMap",
  "WeakSet",
];

export const baseDefs: [TypeId, AnySchemaNode][] = [
  ["Date" as TypeId, { kind: "error", extra: "Well Known" }],
];
