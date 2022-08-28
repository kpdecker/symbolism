import invariant from "tiny-invariant";
import ts from "typescript";
import { SchemaContext } from "../context";
import { AnySchemaNode } from "../schema";
import { narrowTypeFromValues } from "../value-eval";
import { booleanPrimitiveSchema } from "../well-known-schemas";

export function convertLiteralOrPrimitive(
  type: ts.Type,
  context: SchemaContext
): AnySchemaNode | undefined {
  const { contextNode } = context;
  invariant(typeof contextNode === "object", "No context node");

  if (type.flags & ts.TypeFlags.BigIntLiteral) {
    const literalType = type as ts.BigIntLiteralType;
    return {
      kind: "literal",
      value: BigInt(
        literalType.value.negative ? "-" : "" + literalType.value.base10Value
      ),
    };
  } else if (type.isLiteral()) {
    const literalType = type as ts.LiteralType;
    return {
      kind: "literal",
      value: literalType.value as Exclude<
        ts.LiteralType["value"],
        ts.PseudoBigInt
      >,
    };
  } else if (type.flags & ts.TypeFlags.Boolean) {
    return narrowTypeFromValues(context, type) || booleanPrimitiveSchema;
  } else if (type.flags & ts.TypeFlags.BooleanLiteral) {
    return {
      kind: "literal",
      value: (type as any).intrinsicName === "true",
    };
  } else if (type.flags & ts.TypeFlags.Number) {
    return (
      narrowTypeFromValues(context, type) || {
        kind: "primitive",
        name: "number",
        node: contextNode,
      }
    );
  } else if (type.flags & ts.TypeFlags.BigInt) {
    return (
      narrowTypeFromValues(context, type) || {
        kind: "primitive",
        name: "bigint",
        node: contextNode,
      }
    );
  } else if (type.flags & ts.TypeFlags.String) {
    return (
      narrowTypeFromValues(context, type) || {
        kind: "primitive",
        name: "string",
        node: contextNode,
      }
    );
  } else if (type.flags & ts.TypeFlags.Any) {
    return (
      narrowTypeFromValues(context, type) || {
        kind: "primitive",
        name: "any",
        node: contextNode,
      }
    );
  } else if (type.flags & ts.TypeFlags.Never) {
    return {
      kind: "primitive",
      name: "never",
      node: contextNode,
    };
  } else if (type.flags & ts.TypeFlags.Unknown) {
    return (
      narrowTypeFromValues(context, type) || {
        kind: "primitive",
        name: "unknown",
        node: contextNode,
      }
    );
  } else if (type.flags & ts.TypeFlags.Null) {
    return {
      kind: "literal",
      value: null,
    };
  } else if (type.flags & ts.TypeFlags.Undefined) {
    return {
      kind: "literal",
      value: undefined,
    };
  } else if (type.flags & ts.TypeFlags.Void) {
    return {
      kind: "literal",
      value: void 0,
    };
  } else if (
    type.flags & ts.TypeFlags.ESSymbol ||
    type.flags & ts.TypeFlags.UniqueESSymbol
  ) {
    return {
      kind: "primitive",
      name: "symbol",
      node: contextNode,
    };
  } else if (type.flags & ts.TypeFlags.NonPrimitive) {
    return {
      kind: "primitive",
      name: "object",
      node: contextNode,
    };
  }
}
