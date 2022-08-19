import { LiteralSchema, PrimitiveSchema, UnionSchema } from "./schema";

export const undefinedSchema: LiteralSchema = {
  kind: "literal",
  value: undefined,
};

export const neverSchema: Readonly<PrimitiveSchema> = {
  kind: "primitive",
  name: "never",
  // @ts-expect-error Would rather error early than debug an infinite loop.
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
  // @ts-expect-error Would rather error early than debug an infinite loop.
  node: undefined,
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
