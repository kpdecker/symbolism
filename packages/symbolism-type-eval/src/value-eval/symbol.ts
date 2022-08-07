import ts from "typescript";
import { AnySchemaNode } from "../schema";
import { evaluateBinaryExpressionSchema } from "./binary-expression";

export function resolveSymbolsInSchema(
  schema: AnySchemaNode,
  symbolSchemas: Map<ts.Symbol, AnySchemaNode>,
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
    if (symbol && symbolSchemas.get(symbol)) {
      return symbolSchemas.get(symbol)!;
    }

    return schema;
  }

  if (schema.kind === "binary-expression") {
    const resolved = schema.items.map((item) =>
      resolveSymbolsInSchema(item, symbolSchemas, checker)
    );

    return evaluateBinaryExpressionSchema(
      resolved[0],
      resolved[1],
      schema.operator
    );
  }

  if (
    schema.kind === "union" ||
    schema.kind === "intersection" ||
    schema.kind === "tuple" ||
    schema.kind === "template-literal"
  ) {
    // TODO: Reduce
    return {
      ...schema,
      items: schema.items.map((item) =>
        resolveSymbolsInSchema(item, symbolSchemas, checker)
      ),
    };
  }

  if (schema.kind === "array") {
    return {
      ...schema,
      items: resolveSymbolsInSchema(schema.items, symbolSchemas, checker),
    };
  }

  if (schema.kind === "object") {
    return {
      ...schema,
      properties: Object.entries(schema.properties).reduce(
        (acc, [key, value]) => {
          acc[key] = resolveSymbolsInSchema(value, symbolSchemas, checker);
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
        schema: resolveSymbolsInSchema(
          parameter.schema,
          symbolSchemas,
          checker
        ),
      })),
      returnType: resolveSymbolsInSchema(
        schema.returnType,
        symbolSchemas,
        checker
      ),
    };
  }

  const gottaCatchEmAll: never = schema;
  throw new Error("Not implemented");
}
