import { JsonObject } from "type-fest";
import ts from "typescript";
import { isNumericSchema } from "../classify";
import type { AnySchemaNode, Schema } from "../schema";
import { schemaToRegEx } from "../string";
import { printSchemaNode } from "./typescript";

export function createJsonSchema(params: {
  schema: Schema;
  $id: string;
  $comment?: string;
}): JsonObject {
  const { schema, $id, $comment } = params;

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id,
    $comment,
    ...schemaToJson(schema.root),
  };
}

export function schemaToJson(
  schema: AnySchemaNode | undefined
): JsonObject | null {
  if (!schema) {
    return null;
  }

  switch (schema.kind) {
    case "primitive":
      return { type: schema.name };
    case "literal":
      if (typeof schema.value === "bigint") {
        return { const: `"${schema.value}"` };
      }
      return { const: schema.value ?? null };
    case "array":
      return {
        type: "array",
        items: schemaToJson(schema.items),
      };
    case "tuple":
      return {
        type: "array",
        // TODO: Variable length tuples
        maxItems: schema.items.length,
        minItems: schema.items.length,
        prefixItems: schema.items.map((item, i) => {
          // TODO: Emit flags
          const elementFlags = schema.elementFlags[i];
          const isRest = elementFlags & ts.ElementFlags.Rest;
          const isOptional = elementFlags & ts.ElementFlags.Optional;
          return schemaToJson(item);
        }),
      };
    case "object":
      return {
        type: "object",
        properties: Object.keys(schema.properties)
          .sort()
          .reduce((acc, name) => {
            acc[name] = schemaToJson(schema.properties[name]);
            return acc;
          }, {} as Record<string, JsonObject | null>),
        patternProperties: schema.abstractIndexKeys.length
          ? schema.abstractIndexKeys.reduce((acc, { key, value }) => {
              acc[schemaToRegEx(key) + ""] = schemaToJson(value);
              return acc;
            }, {} as Record<string, JsonObject | null>)
          : undefined,
      };
    case "function":
      return {
        type: "error",
        message: `${printSchemaNode(schema)} is not supported in JSON schema`,
      };
    case "binary-expression":
      if (
        isNumericSchema(schema.items[0]) &&
        isNumericSchema(schema.items[1])
      ) {
        return {
          type: "number",
        };
      }
      return {
        type: "string",
      };
    case "index":
      return {
        type: "error",
        message: `${printSchemaNode(schema)} is not supported in JSON schema`,
      };
    case "index-access":
      return {
        type: "error",
        message: `${printSchemaNode(schema)} is not supported in JSON schema`,
      };
    case "error":
      return {
        type: "error",
        message: JSON.stringify("error! " + schema.extra),
      };
    case "union":
      const anyOf = schema.items.map(schemaToJson);
      const literals = anyOf.filter((item) => item?.const);
      if (literals.length === schema.items.length) {
        return {
          type: "string",
          enum: literals.map((item) => item?.const!),
        };
      }
      return {
        anyOf,
      };
    case "intersection":
      return {
        oneOf: schema.items.map(schemaToJson),
      };
    case "template-literal":
      return {
        type: "string",
        pattern: schemaToRegEx(schema) + "",
      };
    case "reference":
      return {
        $ref: `#/$defs/${schema.name}`,
      };

    default:
      const gottaCatchEmAll: never = schema;
      throw new Error(`Unsupported schema kind ${(schema as any).kind}`);
  }
}
