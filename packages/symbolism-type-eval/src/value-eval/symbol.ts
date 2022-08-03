import { dumpNode, dumpSymbol } from "@symbolism/ts-debug";
import ts from "typescript";
import { AnySchemaNode } from "../schema";

export function resolveSymbolsInSchema(
  schema: AnySchemaNode,
  symbols: Map<ts.Symbol, AnySchemaNode>,
  checker: ts.TypeChecker
): AnySchemaNode {
  if (
    !schema ||
    schema.kind === "literal" ||
    (schema.kind === "primitive" &&
      ["undefined", "void", "null"].includes(schema.name))
  ) {
    return schema;
  }

  if (
    schema.kind === "primitive" ||
    schema.kind === "error" ||
    // Type checker would have resolved this if it was concrete.
    schema.kind === "index" ||
    schema.kind === "index-access"
  ) {
    const symbol = checker.getSymbolAtLocation(schema.node);
    if (symbol && symbols.get(symbol)) {
      return symbols.get(symbol)!;
    }

    return schema;
  }

  if (
    schema.kind === "union" ||
    schema.kind === "intersection" ||
    schema.kind === "tuple" ||
    schema.kind === "template-literal" ||
    schema.kind === "binary-expression"
  ) {
    return {
      ...schema,
      items: schema.items.map((item) =>
        resolveSymbolsInSchema(item, symbols, checker)
      ),
    };
  }

  if (schema.kind === "array") {
    return {
      ...schema,
      items: resolveSymbolsInSchema(schema.items, symbols, checker),
    };
  }

  if (schema.kind === "object") {
    return {
      ...schema,
      properties: Object.entries(schema.properties).reduce(
        (acc, [key, value]) => {
          acc[key] = resolveSymbolsInSchema(value, symbols, checker);
          return acc;
        },
        {} as Record<string, AnySchemaNode>
      ),
    };
  }

  if (schema.kind === "function") {
    return {
      ...schema,
      parameters: schema.parameters.map((parameter) => ({
        ...parameter,
        name: parameter.name,
        schema: resolveSymbolsInSchema(parameter.schema, symbols, checker),
      })),
      returnType: resolveSymbolsInSchema(schema.returnType, symbols, checker),
    };
  }

  const gottaCatchEmAll: never = schema;
  throw new Error("Not implemented");
}
