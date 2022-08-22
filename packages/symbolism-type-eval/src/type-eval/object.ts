import { dumpFlags, dumpNode, dumpSymbol } from "@symbolism/ts-debug";
import { getSymbolDeclaration, isTypeReference } from "@symbolism/ts-utils";
import ts from "typescript";
import { createReferenceFromType, getTypeSchema } from ".";
import { SchemaContext } from "../context";
import { AnySchemaNode, ObjectSchema } from "../schema";
import { getNodeSchema } from "../value-eval";

export function convertObjectType(
  type: ts.Type,
  context: SchemaContext
): AnySchemaNode {
  const { contextNode, checker } = context;

  if (ts.isObjectLiteralExpression(contextNode)) {
    const sourceType = getNodeSchema(
      ...context.cloneNode({
        node: contextNode,
        decrementDepth: false,
        allowMissing: true,
      })
    );
    if (sourceType) {
      return sourceType;
    }
  }

  const properties: Record<string, AnySchemaNode> = type
    .getProperties()
    .map((p): [string, AnySchemaNode] => {
      const propertyDeclaration = getSymbolDeclaration(p);

      let name = p.getName();
      if (propertyDeclaration) {
        if (
          ts.isPropertyDeclaration(propertyDeclaration) ||
          ts.isMethodSignature(propertyDeclaration)
        ) {
          if (ts.isComputedPropertyName(propertyDeclaration.name)) {
            name = "[" + propertyDeclaration.name.expression.getText() + "]";
          }
        }
      }

      return [name, convertSymbol(p, context)];
    })
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

  // Note that this is not typescript syntax compliant
  const abstractIndexKeys: ObjectSchema["abstractIndexKeys"] = [];

  checker.getIndexInfosOfType(type).forEach((indexInfo) => {
    abstractIndexKeys.push({
      key: getTypeSchema(
        ...context.clone({
          type: indexInfo.keyType,
          node: indexInfo.declaration,
          decrementDepth: true,
        })
      ),
      value: getTypeSchema(
        ...context.clone({
          type: indexInfo.type,
          node: indexInfo.declaration,
          decrementDepth: true,
        })
      ),
    });
  });

  return {
    kind: "object",
    properties,
    abstractIndexKeys,
  };
}

function convertSymbol(
  symbol: ts.Symbol,
  context: SchemaContext
): AnySchemaNode {
  const declaration = getSymbolDeclaration(symbol);
  if (declaration) {
    const type = context.checker.getTypeOfSymbolAtLocation(symbol, declaration);
    return getTypeSchema(
      ...context.clone({
        type,
        node: declaration,
        decrementDepth: true,
      })
    );
  }

  const properties: Record<string, AnySchemaNode> = {};
  const abstractIndexKeys: ObjectSchema["abstractIndexKeys"] = [];

  let finalSymbol = symbol;
  if (symbol.flags & ts.SymbolFlags.Prototype) {
    finalSymbol = (symbol as any).parent;
  }

  finalSymbol.members?.forEach((member, name) => {
    properties[ts.unescapeLeadingUnderscores(name)] = convertSymbol(
      member,
      context
    );
  });

  return {
    kind: "object",
    properties,
    abstractIndexKeys,
  };
}
