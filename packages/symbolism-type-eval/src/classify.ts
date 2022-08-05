import invariant from "tiny-invariant";
import ts from "typescript";
import { AnySchemaNode, UnionSchema } from "./schema";

/**
 * Determines if the schema is fully resolved without
 * any non-finite values.
 */
export function isConcreteSchema(
  type: AnySchemaNode | undefined
): type is AnySchemaNode {
  if (!type) {
    return false;
  }

  if (
    type.kind === "primitive" &&
    ["undefined", "void", "null"].includes(type.name)
  ) {
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

  if (type.kind === "literal") {
    return true;
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
    return Object.values(type.properties).every(isConcreteSchema);
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

export function nonConcreteInputs(type: AnySchemaNode | undefined): ts.Node[] {
  if (!type) {
    return [];
  }

  if (
    type.kind === "primitive" &&
    ["undefined", "void", "null"].includes(type.name)
  ) {
    return [];
  }

  if (
    type.kind === "primitive" ||
    type.kind === "error" ||
    // Type checker would have resolved this if it was concrete.
    type.kind === "index" ||
    type.kind === "index-access"
  ) {
    return [type.node];
  }

  if (type.kind === "literal") {
    return [];
  }

  if (
    type.kind === "union" ||
    type.kind === "intersection" ||
    type.kind === "tuple" ||
    type.kind === "template-literal" ||
    type.kind === "binary-expression"
  ) {
    return type.items.flatMap(nonConcreteInputs);
  }

  if (type.kind === "array") {
    return nonConcreteInputs(type.items);
  }

  if (type.kind === "object") {
    return Object.values(type.properties).flatMap(nonConcreteInputs);
  }

  if (type.kind === "function") {
    return nonConcreteInputs(type.returnType).concat(
      ...type.parameters.flatMap(({ schema }) => nonConcreteInputs(schema))
    );
  }

  const gottaCatchEmAll: never = type;
  throw new Error("Not implemented");
}

export function isLiteralUnion(type: AnySchemaNode): type is UnionSchema {
  return (
    type.kind === "union" && type.items.every((item) => item.kind === "literal")
  );
}

export function isNumericSchema(type: AnySchemaNode): boolean {
  if (type.kind === "union" || type.kind === "intersection") {
    return type.items.every(isNumericSchema);
  }

  return (
    (type.kind === "primitive" && type.name === "number") ||
    (type.kind === "literal" && typeof type.value === "number")
  );
}

export function areSchemasEqual(a: AnySchemaNode, b: AnySchemaNode): boolean {
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
    return b.kind === "literal" && a.value === b.value;
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
