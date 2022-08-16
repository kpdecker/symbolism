import { logDebug, NodeError } from "@symbolism/utils";
import invariant from "tiny-invariant";
import ts from "typescript";
import { convertNode, convertValueExpression, TypeEvalOptions } from ".";
import { isConcreteSchema } from "../classify";
import { printSchema } from "../print/typescript";
import { AnySchemaNode, convertTSTypeToSchema, ObjectSchema } from "../schema";
import { SchemaContext } from "../context";
import { expandSchemaList, unionProperties } from "./union";
import { dumpNode } from "@symbolism/ts-debug";

export function convertObjectLiteralValue(
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
      ? convertValueExpression(...context.cloneNode(name.expression), {
          allowMissing: false,
        })
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
    } else if (spreadSchema.kind === "literal") {
      /* NOP */
    } else if (spreadSchema.kind === "union") {
      // TODO: Consider expanding the union vs. inlining all props?
      spreadSchema.items.forEach((item) => {
        spreadProperties(item, node);
      });
    } else {
      throw new NodeError(
        `Spread not impl ${spreadSchema.kind} ${printSchema(spreadSchema)}`,
        node,
        context.checker
      );
    }
  }

  node.properties.forEach((property) => {
    if (ts.isSpreadAssignment(property)) {
      const spreadSchema = convertNode(property.expression, context);
      spreadProperties(spreadSchema, property);
    } else if (ts.isPropertyAssignment(property)) {
      const schema = convertNode(property.initializer, context);

      setProperties(property.name, schema);
    } else if (ts.isShorthandPropertyAssignment(property)) {
      const propertyName = property.name.text;
      const schema = convertNode(property.name, context);

      if (schema) {
        properties[propertyName] = schema;
      }
    } else if (
      ts.isMethodDeclaration(property) ||
      ts.isGetAccessorDeclaration(property) ||
      ts.isSetAccessorDeclaration(property)
    ) {
      let schema: AnySchemaNode | undefined;
      if (ts.isGetAccessorDeclaration(property)) {
        const signature = checker.getSignatureFromDeclaration(property);
        invariant(signature, "Expected get accessor signature");

        schema = convertTSTypeToSchema(
          ...context.clone(signature.getReturnType(), property)
        );
      } else {
        schema = convertNode(property, context);
      }

      setProperties(property.name, schema);
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

export function convertElementAccessExpression(
  node: ts.ElementAccessExpression,
  context: SchemaContext,
  options: TypeEvalOptions
): AnySchemaNode | undefined {
  const parentSchema = convertValueExpression(
    ...context.cloneNode(node.expression),
    { allowMissing: true }
  ) || {
    kind: "primitive",
    name: "any",
    node: node.expression,
  };
  const argumentSchema = convertValueExpression(
    ...context.cloneNode(node.argumentExpression),
    { allowMissing: true }
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
      return {
        kind: "union",
        items: [
          Object.values(parentSchema.properties).concat(
            parentSchema.abstractIndexKeys.map(({ value }) => value)
          ),
        ].flat(),
      };
    } else if (argumentSchema.kind === "literal") {
      const argValue = argumentSchema.value as string | number;
      if (argValue in parentSchema.properties) {
        return parentSchema.properties[argValue];
      }
    }

    return {
      kind: "literal",
      value: undefined,
    };
  } else if (parentSchema.kind === "array") {
    return parentSchema.items;
  } else if (parentSchema.kind === "primitive") {
    if (parentSchema.name === "any") {
      return parentSchema;
    }

    // Resolve via TS
    return argumentSchema;
  } else if (parentSchema.kind === "literal") {
    return argumentSchema;
  } else if (parentSchema.kind === "union") {
    if (argumentSchema.kind === "primitive") {
      const properties = unionProperties(parentSchema);
      return {
        kind: "union",
        items: Object.values(properties),
      };
    }

    return argumentSchema;
  }

  if (!options.allowMissing) {
    throw new Error(`Unsupported expression: ${ts.SyntaxKind[node.kind]}`);
  } else {
    logDebug(
      `Unsupported expression: ${
        ts.SyntaxKind[node.kind]
      }\n\nNode: ${JSON.stringify(dumpNode(node, context.checker))}`
    );
  }
}
