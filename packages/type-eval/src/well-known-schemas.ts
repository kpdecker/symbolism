import { TypeId } from "@noom/symbolism-ts-utils";
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

  // Disable window and document for now. Inspection of these types has significant
  // overhead and it's assumed that schema documentation needs will be minimal for these.
  "Window",
  "Document",
];

export const baseDefs: [TypeId, AnySchemaNode][] = [
  ["Date" as TypeId, { kind: "error", extra: "Well Known" }],
];
