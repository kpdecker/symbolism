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
