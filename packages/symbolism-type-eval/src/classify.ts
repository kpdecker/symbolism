import invariant from "tiny-invariant";
import ts from "typescript";
import { AnySchemaNode, UnionSchema } from "./schema";

/**
 * Determines if the schema is fully resolved without
 * any non-finite values.
 */
export function isConcreteSchema(type: AnySchemaNode): boolean {
  if (
    type.kind === "primitive" ||
    type.kind === "function" ||
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
    type.kind === "template-literal"
  ) {
    return type.items.every(isConcreteSchema);
  }

  if (type.kind === "array") {
    return isConcreteSchema(type.items);
  }

  if (type.kind === "object") {
    return Object.values(type.properties).every(isConcreteSchema);
  }

  const gottaCatchEmAll: never = type;
  throw new Error("Not implemented");
}

export function isLiteralUnion(type: AnySchemaNode): type is UnionSchema {
  return (
    type.kind === "union" && type.items.every((item) => item.kind === "literal")
  );
}
