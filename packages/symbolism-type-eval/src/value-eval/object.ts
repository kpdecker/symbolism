import { logDebug, NodeError } from "@symbolism/utils";
import invariant from "tiny-invariant";
import ts from "typescript";
import { isConcreteSchema, SchemaError } from "../classify";
import { printSchema } from "../print/typescript";
import { AnySchemaNode, ObjectSchema } from "../schema";
import { SchemaContext } from "../context";
import { createUnionKind, expandSchemaList, unionProperties } from "./union";
import { dumpNode } from "@symbolism/ts-debug";
import { getNodeSchema } from ".";
import { nodeEvalHandler, variableLike } from "./handlers";
import { getSymbolDeclaration, invariantNode } from "@symbolism/ts-utils";
import { getLocalSymbol } from "./symbol";
import { neverSchema, undefinedSchema } from "../well-known-schemas";

export const objectOperators = nodeEvalHandler({
  [ts.SyntaxKind.ObjectLiteralExpression](node, context) {
    invariantNode(node, context.checker, ts.isObjectLiteralExpression);
    return convertObjectLiteralValue(node, context);
  },
  [ts.SyntaxKind.PropertyAssignment]: variableLike,
  [ts.SyntaxKind.ShorthandPropertyAssignment](node, context) {
    invariantNode(node, context.checker, ts.isShorthandPropertyAssignment);

    const { checker } = context;
    const symbol = getLocalSymbol(node, checker);
    const declaration = getSymbolDeclaration(symbol);
    if (declaration) {
      return getNodeSchema({
        context,
        node: declaration,
        decrementDepth: false,
      });
    }
  },
  [ts.SyntaxKind.SpreadAssignment](node, context) {
    invariantNode(node, context.checker, ts.isSpreadAssignment);
    return getNodeSchema({
      context,
      node: node.expression,
      decrementDepth: false,
    });
  },
  [ts.SyntaxKind.ComputedPropertyName](node, context) {
    invariantNode(node, context.checker, ts.isComputedPropertyName);
    return getNodeSchema({
      context,
      node: node.expression,
      decrementDepth: false,
    });
  },

  [ts.SyntaxKind.PropertyAccessExpression](node, context) {
    invariantNode(node, context.checker, ts.isPropertyAccessExpression);
    return getNodeSchema({
      context,
      node: node.name,
      decrementDepth: false,
      allowMissing: false,
    });
  },
  [ts.SyntaxKind.ElementAccessExpression](node, context) {
    invariantNode(node, context.checker, ts.isElementAccessExpression);
    return convertElementAccessExpression(node, context);
  },
});

function convertObjectLiteralValue(
  node: ts.Node,
  context: SchemaContext
): AnySchemaNode | undefined {
  invariant(ts.isObjectLiteralExpression(node), "Expected object literal");

  const { checker } = context;

  const properties: Record<string, AnySchemaNode> = {};
  const abstractIndexKeys: ObjectSchema["abstractIndexKeys"] = [];

  function evaluatePropertyName(
    name: ts.PropertyName
  ): string[] | AnySchemaNode {
    const propertyName = ts.isComputedPropertyName(name)
      ? context.resolveSchema(
          getNodeSchema({
            context,
            node: name.expression,
            decrementDepth: true,
            allowMissing: false,
          })
        )
      : name.text;
    invariant(propertyName, "Expected property name");

    if (typeof propertyName === "string") {
      return [propertyName];
    }
    if (isConcreteSchema(propertyName)) {
      const expandedSchema = expandSchemaList({
        items: [propertyName],
        merger(right, left) {
          if (left.kind === "literal" && right.kind === "literal") {
            return {
              kind: "literal",
              value: "" + left.value + right.value,
            };
          }
        },
      });

      return expandedSchema.map((schema) => {
        invariant(
          schema.kind === "literal",
          `Expected literal but got ${schema.kind}`
        );
        return "" + schema.value;
      });
    }

    return propertyName! as AnySchemaNode;
  }

  function spreadProperties(spreadSchema: AnySchemaNode, node: ts.Node) {
    spreadSchema = context.resolveSchema(spreadSchema);

    if (spreadSchema.kind === "object") {
      Object.assign(properties, spreadSchema.properties);
      abstractIndexKeys.push(...spreadSchema.abstractIndexKeys);
    } else if (
      spreadSchema.kind === "primitive" &&
      spreadSchema.name === "any"
    ) {
      abstractIndexKeys.push({
        key: spreadSchema,
        value: spreadSchema,
      });
    } else if (spreadSchema.kind === "union") {
      // TODO: Consider expanding the union vs. inlining all props?
      spreadSchema.items.forEach((item) => {
        spreadProperties(item, node);
      });
    } else if (
      spreadSchema.kind === "primitive" ||
      spreadSchema.kind === "literal" ||
      spreadSchema.kind === "template-literal"
    ) {
      /* NOP */
    } else {
      throw new NodeError(
        `Spread not impl ${spreadSchema.kind} ${printSchema({
          root: spreadSchema,
        })}`,
        node,
        context.checker
      );
    }
  }

  node.properties.forEach((property) => {
    if (ts.isSpreadAssignment(property)) {
      const spreadSchema = getNodeSchema({
        context,
        node: property.expression,
        decrementDepth: true,
        allowMissing: false,
      })!;
      spreadProperties(spreadSchema, property);
    } else if (
      ts.isPropertyAssignment(property) ||
      ts.isMethodDeclaration(property) ||
      ts.isGetAccessorDeclaration(property) ||
      ts.isSetAccessorDeclaration(property)
    ) {
      let schema = getNodeSchema({
        context,
        node: property,
        decrementDepth: true,
        allowMissing: false,
      })!;

      setProperties(property.name, schema);
    } else if (ts.isShorthandPropertyAssignment(property)) {
      const propertyName = property.name.text;
      const schema = getNodeSchema({
        context,
        node: property,
        decrementDepth: true,
        allowMissing: false,
      })!;

      properties[propertyName] = schema;
    } else {
      throw new NodeError("Unsupported property", property, checker);
    }
  });

  function setProperties(propertyName: ts.PropertyName, schema: AnySchemaNode) {
    const propertyNames = evaluatePropertyName(propertyName);

    if (schema) {
      if (Array.isArray(propertyNames)) {
        propertyNames.forEach((name) => {
          properties[name] = schema;
        });
      } else {
        abstractIndexKeys.push({
          key: propertyNames,
          value: schema,
        });
      }
    }
  }

  return {
    kind: "object",
    properties,
    abstractIndexKeys,
  };
}

function convertElementAccessExpression(
  node: ts.ElementAccessExpression,
  context: SchemaContext
): AnySchemaNode | undefined {
  const { checker } = context;

  const parentSchema = context.resolveSchema(
    getNodeSchema({
      context,
      node: node.expression,
      decrementDepth: false,
      allowMissing: true,
    })
  ) || {
    kind: "primitive",
    name: "any",
    node: node.expression,
  };
  const argumentSchema = context.resolveSchema(
    getNodeSchema({
      context,
      node: node.argumentExpression,
      decrementDepth: false,
      allowMissing: true,
    })
  ) || {
    kind: "primitive",
    name: "any",
    node: node.argumentExpression,
  };

  if (argumentSchema.kind === "error") {
    return argumentSchema;
  }
  if (parentSchema.kind === "error") {
    return parentSchema;
  }

  if (argumentSchema.kind === "function") {
    return argumentSchema;
  }

  if (parentSchema.kind === "object") {
    if (argumentSchema.kind === "primitive") {
      return createUnionKind(
        Object.values(parentSchema.properties)
          .concat(parentSchema.abstractIndexKeys.map(({ value }) => value))
          .flat()
      );
    } else if (argumentSchema.kind === "literal") {
      const argValue = argumentSchema.value + "";
      const parentType = checker.getTypeAtLocation(node.expression);
      const property = parentType.getProperty(argValue);
      const propertyDeclaration = getSymbolDeclaration(property);
      if (propertyDeclaration) {
        return getNodeSchema({
          context,
          node: propertyDeclaration,
          decrementDepth: true,
        });
      }
    }

    return {
      kind: "literal",
      value: undefined,
    };
  } else if (parentSchema.kind === "array") {
    return parentSchema.items;
  } else if (parentSchema.kind === "primitive") {
    if (parentSchema.name === "any" || parentSchema.name === "never") {
      return parentSchema;
    }

    // Resolve via TS
    return argumentSchema;
  } else if (parentSchema.kind === "literal") {
    if (argumentSchema.kind === "primitive") {
      const baseType = checker.getBaseTypeOfLiteralType(
        checker.getTypeAtLocation(node.expression)
      );
      const properties = baseType.getProperties();
      return createUnionKind(
        properties.map((property) => {
          const propertyDeclaration = getSymbolDeclaration(property);
          if (propertyDeclaration) {
            const schema = getNodeSchema({
              context,
              node: propertyDeclaration,
              decrementDepth: true,
            });
            if (schema) {
              return schema;
            }
          }
          return {
            kind: "error",
            message: `Could not resolve property ${property.getName()}`,
            node,
          };
        })
      );
    } else if (argumentSchema.kind === "literal") {
      // We have concrete literals on both sides, evaluate the result in js space
      const argValue = argumentSchema.value + "";
      if (parentSchema.value != null) {
        const value = (parentSchema.value as any)[argValue];
        if (
          value === null ||
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          return {
            kind: "literal",
            value,
          };
        }
      }

      return undefinedSchema;
    }

    return neverSchema;
  } else if (parentSchema.kind === "union") {
    // If we are primitive types only, return the identity.
    // This case can occur when working with enums as they eval to a union of primitives.
    if (parentSchema.items.find((item) => item.kind === "literal")) {
      return neverSchema;
    }

    if (
      argumentSchema.kind === "primitive" ||
      argumentSchema.kind === "literal"
    ) {
      const properties = unionProperties(parentSchema);

      if (argumentSchema.kind === "primitive") {
        return createUnionKind(Object.values(properties));
      } else {
        const argValue = argumentSchema.value + "";
        const property = properties[argValue];
        if (property) {
          return property;
        }
      }
    }

    return neverSchema;
  }

  if (!context.options.allowMissing) {
    throw new SchemaError(
      `Unable to resolve expression: ${ts.SyntaxKind[node.kind]}`,
      parentSchema
    );
  } else {
    logDebug(
      `Unable to resolve expression: ${
        ts.SyntaxKind[node.kind]
      }\n\nNode: ${JSON.stringify(dumpNode(node, context.checker))}`
    );
  }
}
