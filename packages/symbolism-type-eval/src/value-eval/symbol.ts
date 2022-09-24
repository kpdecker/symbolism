import { isNamedDeclaration } from "@symbolism/ts-utils";
import { assertExists, assertUnreachable } from "@symbolism/utils";
import ts from "typescript";
import { bindParameterDependency, findParameterDependency } from "../classify";
import { SchemaContext } from "../context";
import { AnySchemaNode } from "../schema";
import { evaluateBinaryExpressionSchema } from "./binary-expression";

export function resolveParametersInSchema(
  schema: AnySchemaNode,
  parameterSchemas: Map<ts.Node, AnySchemaNode>,
  context: SchemaContext
): AnySchemaNode {
  if (!schema || schema.kind === "literal") {
    return schema;
  }

  if (schema.node) {
    const parameter = findParameterDependency(schema.node, context.checker);
    if (parameter && parameterSchemas.get(parameter)) {
      const ret = bindParameterDependency(
        schema.node,
        {
          node: parameter,
          schema: assertExists(parameterSchemas.get(parameter)),
        },
        context
      );
      if (ret) {
        return ret;
      }

      // Fall through:
      // No parameter updates applied, i.e. may reference a different closure scope
    }
  }

  if (
    schema.kind === "primitive" ||
    schema.kind === "error" ||
    // Type checker would have resolved this if it was concrete.
    schema.kind === "index" ||
    schema.kind === "index-access"
  ) {
    return schema;
  }

  if (schema.kind === "binary-expression") {
    const resolved = schema.items.map((item) =>
      resolveParametersInSchema(item, parameterSchemas, context)
    );

    return evaluateBinaryExpressionSchema(
      resolved[0],
      resolved[1],
      schema.operator,
      context
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
        resolveParametersInSchema(item, parameterSchemas, context)
      ),
    };
  }

  if (schema.kind === "array") {
    return {
      ...schema,
      items: resolveParametersInSchema(schema.items, parameterSchemas, context),
    };
  }

  if (schema.kind === "object") {
    return {
      ...schema,
      properties: Object.entries(schema.properties).reduce(
        (acc, [key, value]) => {
          acc[key] = resolveParametersInSchema(
            value,
            parameterSchemas,
            context
          );
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
        schema: resolveParametersInSchema(
          parameter.schema,
          parameterSchemas,
          context
        ),
      })),
      returnType: resolveParametersInSchema(
        schema.returnType,
        parameterSchemas,
        context
      ),
    };
  }

  if (schema.kind === "reference") {
    return schema;
  }

  assertUnreachable(schema);
}

export function getLocalSymbol(
  node: ts.Node | undefined,
  checker: ts.TypeChecker
): ts.Symbol | undefined {
  if (!node) {
    return undefined;
  }

  if (isNamedDeclaration(node)) {
    return getLocalSymbol(node.name, checker);
  }

  if (ts.isShorthandPropertyAssignment(node)) {
    return getLocalSymbol(node.name, checker);
  }

  return ts.isShorthandPropertyAssignment(node.parent)
    ? checker.getShorthandAssignmentValueSymbol(node.parent)
    : checker.getSymbolAtLocation(node);
}
