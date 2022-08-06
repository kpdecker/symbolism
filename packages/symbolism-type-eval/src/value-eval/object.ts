import { dumpNode } from "@symbolism/ts-debug";
import { NodeError } from "@symbolism/utils";
import invariant from "tiny-invariant";
import ts from "typescript";
import { convertNode, convertValueExpression } from ".";
import { isConcreteSchema } from "../classify";
import { printSchema } from "../print/typescript";
import {
  AnySchemaNode,
  convertTSTypeToSchema,
  ObjectSchema,
  SchemaContext,
} from "../schema";
import { expandSchemaList } from "./union";

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
      ? convertValueExpression(...context.cloneNode(name.expression))
      : name.text;

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
        invariant(schema.kind === "literal");
        return "" + schema.value;
      });
    }

    return propertyName! as AnySchemaNode;
  }

  node.properties.forEach((property) => {
    if (ts.isSpreadAssignment(property)) {
      const spreadSchema = convertNode(property.expression, context);
      if (spreadSchema.kind === "object") {
        Object.assign(properties, spreadSchema.properties);
        abstractIndexKeys.push(...spreadSchema.abstractIndexKeys);
      } else {
        throw new NodeError(
          `Not Impl ${spreadSchema.kind} ${printSchema(spreadSchema)}`,
          property,
          context.checker
        );
      }
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
