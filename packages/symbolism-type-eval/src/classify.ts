import { removeDuplicates } from "@symbolism/utils";
import invariant from "tiny-invariant";
import ts from "typescript";
import { AnySchemaNode, PrimitiveSchema, UnionSchema } from "./schema";

/**
 * Determines if the schema is fully resolved without
 * any non-finite values.
 */
export function isConcreteSchema(type: AnySchemaNode | undefined): boolean {
  if (!type) {
    return false;
  }

  if (type.kind === "literal") {
    return true;
  }

  if (
    type.kind === "primitive" ||
    type.kind === "error" ||
    // Type checker would have resolved this if it was concrete.
    type.kind === "index" ||
    type.kind === "index-access"
  ) {
    return false;
  }

  if (
    type.kind === "union" ||
    type.kind === "intersection" ||
    type.kind === "tuple" ||
    type.kind === "template-literal" ||
    type.kind === "binary-expression"
  ) {
    return type.items.every(isConcreteSchema);
  }

  if (type.kind === "array") {
    return isConcreteSchema(type.items);
  }

  if (type.kind === "object") {
    return (
      Object.values(type.properties).every(isConcreteSchema) &&
      !type.abstractIndexKeys.length
    );
  }

  if (type.kind === "function") {
    return (
      type.parameters.every(({ schema }) => isConcreteSchema(schema)) &&
      isConcreteSchema(type.returnType)
    );
  }

  const gottaCatchEmAll: never = type;
  throw new Error("Not implemented");
}

export function nonConcreteInputs(
  schema: AnySchemaNode | undefined
): ts.Node[] {
  if (!schema) {
    return [];
  }

  if (schema.kind === "literal") {
    return [];
  }

  if (
    schema.kind === "primitive" ||
    schema.kind === "error" ||
    // Type checker would have resolved this if it was concrete.
    schema.kind === "index" ||
    schema.kind === "index-access"
  ) {
    return [schema.node];
  }

  if (
    schema.kind === "union" ||
    schema.kind === "intersection" ||
    schema.kind === "tuple" ||
    schema.kind === "template-literal" ||
    schema.kind === "binary-expression"
  ) {
    return schema.items.flatMap(nonConcreteInputs);
  }

  if (schema.kind === "array") {
    return nonConcreteInputs(schema.items);
  }

  if (schema.kind === "object") {
    const abstractKeysSymbols = schema.abstractIndexKeys.flatMap(
      (abstractKey) =>
        nonConcreteInputs(abstractKey.key).concat(
          nonConcreteInputs(abstractKey.value)
        )
    );

    return Object.values(schema.properties)
      .flatMap(nonConcreteInputs)
      .concat(abstractKeysSymbols);
  }

  if (schema.kind === "function") {
    return nonConcreteInputs(schema.returnType).concat(
      ...schema.parameters.flatMap(({ schema }) => nonConcreteInputs(schema))
    );
  }

  const gottaCatchEmAll: never = schema;
  throw new Error("Not implemented");
}

export function isLiteralUnion(type: AnySchemaNode): type is UnionSchema {
  return (
    type.kind === "union" && type.items.every((item) => item.kind === "literal")
  );
}

export function isNumericSchema(type: AnySchemaNode): boolean {
  if (
    type.kind === "union" ||
    type.kind === "intersection" ||
    type.kind === "binary-expression"
  ) {
    return type.items.every(isNumericSchema);
  }

  return (
    (type.kind === "primitive" && type.name === "number") ||
    (type.kind === "literal" && typeof type.value === "number")
  );
}
export function isBooleanSchema(type: AnySchemaNode): boolean {
  if (
    type.kind === "union" ||
    type.kind === "intersection" ||
    type.kind === "binary-expression"
  ) {
    return type.items.every(isBooleanSchema);
  }

  return (
    (type.kind === "primitive" && type.name === "boolean") ||
    (type.kind === "literal" && typeof type.value === "boolean")
  );
}

export function removeDuplicateSchemas<
  T extends AnySchemaNode | AnySchemaNode[]
>(schemas: T[]) {
  // Filter identical items
  return removeDuplicates(schemas, areSchemasEqual);
}
export function areSchemasEqual(
  a: AnySchemaNode | AnySchemaNode[] | undefined,
  b: AnySchemaNode | AnySchemaNode[] | undefined
): boolean {
  if (!a || !b) {
    return a === b;
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      return false;
    }

    return (
      a.length === b.length &&
      a.every((item, schemaIndex) => areSchemasEqual(item, b[schemaIndex]))
    );
  }
  invariant(!Array.isArray(b));

  if (a.kind === "primitive") {
    return a.kind === b.kind && a.name === b.name;
  }

  if (
    a.kind === "error" ||
    // Type checker would have resolved this if it was concrete.
    a.kind === "index" ||
    a.kind === "index-access"
  ) {
    return a.kind === b.kind && a.node === b.node;
  }

  if (a.kind === "literal") {
    return (
      b.kind === "literal" &&
      (a.value === b.value ||
        (Number.isNaN(a.value as any) && Number.isNaN(b.value as any)))
    );
  }

  if (
    a.kind === "union" ||
    a.kind === "intersection" ||
    a.kind === "tuple" ||
    a.kind === "template-literal" ||
    a.kind === "binary-expression"
  ) {
    return (
      a.kind === b.kind &&
      a.items.length === b.items.length &&
      a.items.every((item, index) => areSchemasEqual(item, b.items[index]))
    );
  }

  if (a.kind === "array") {
    return b.kind === "array" && areSchemasEqual(a.items, b.items);
  }

  if (a.kind === "object") {
    if (b.kind !== "object") {
      return false;
    }

    const aProperties = Object.keys(a.properties);
    const bProperties = Object.keys(b.properties);
    return (
      aProperties.length === bProperties.length &&
      aProperties.every((key) =>
        areSchemasEqual(a.properties[key], b.properties[key])
      ) &&
      a.abstractIndexKeys.length === b.abstractIndexKeys.length &&
      a.abstractIndexKeys.every(
        (aIndexKey, i) =>
          areSchemasEqual(aIndexKey.key, b.abstractIndexKeys[i].key) &&
          areSchemasEqual(aIndexKey.value, b.abstractIndexKeys[i].value)
      )
    );
  }

  if (a.kind === "function") {
    return (
      b.kind === "function" &&
      areSchemasEqual(a.returnType, b.returnType) &&
      a.parameters.length === b.parameters.length &&
      a.parameters.every((parameter, i) =>
        areSchemasEqual(parameter.schema, b.parameters[i].schema)
      )
    );
  }

  const gottaCatchEmAll: never = a;
  throw new Error("Not implemented");
}
