import { format } from "prettier";
import invariant from "tiny-invariant";
import ts from "typescript";
import type { AnySchemaNode } from "./schema";

export function printSchema(schema: AnySchemaNode): string {
  const unformattedText = "type foo = " + printSchemaNode(schema);
  try {
    return format(unformattedText, { parser: "typescript" });
  } catch (err) {
    console.log(err);
    // console.log(unformattedText);
    return unformattedText;
  }
}

export function printSchemaNode(schema: AnySchemaNode): string {
  function printString(str: string): string {
    return str
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n");
  }
  switch (schema.kind) {
    case "primitive":
      invariant("name" in schema);
      return schema.name;
    case "literal":
      invariant("value" in schema);
      if (typeof schema.value === "string") {
        return `"${schema.value}"`;
      }
      if (typeof schema.value === "bigint") {
        return `${schema.value}n`;
      }
      return schema.value + "";
    case "array":
      invariant("items" in schema);
      return `(${printSchemaNode(schema.items)})[]`;
    case "tuple":
      invariant("items" in schema);
      return `[${schema.items
        .map((item, i) => {
          const elementFlags = schema.elementFlags[i];
          const isRest = elementFlags & ts.ElementFlags.Rest;
          const isOptional = elementFlags & ts.ElementFlags.Optional;

          return (
            (isRest ? "..." : "") +
            printSchemaNode(item) +
            (isRest ? "[]" : "") +
            (isOptional ? "?" : "")
          );
        })
        .join(", ")}]`;
    case "object":
      invariant("properties" in schema);

      const keys = Object.keys(schema.properties);
      if (keys.length === 1) {
        return `{ ${JSON.stringify(keys[0])}: ${printSchemaNode(
          schema.properties[keys[0]]
        )} }`;
      }

      return (
        "{\n" +
        printString(
          Object.keys(schema.properties)
            .sort()
            .map((name) => {
              const property = schema.properties[name];
              return `  ${JSON.stringify(name)}: ${printSchemaNode(property)},`;
            })
            .join("\n")
        ) +
        "}"
      );
    case "function":
      return JSON.stringify("function " + schema.extra);
    case "error":
      // console.log(schema, new Error().stack);
      return JSON.stringify("error! " + schema.extra);
    case "union":
    case "intersection":
      invariant("items" in schema);
      const separator = schema.kind === "union" ? "\n  | " : "\n  & ";
      return `
  ${separator} ${printString(
        schema.items.map(printSchemaNode).sort().join(separator)
      )}`;
    case "template-literal":
      invariant("items" in schema);
      return `\`${schema.items
        .map((child) => {
          if (child.kind === "literal" && "value" in child) {
            return child.value;
          }
          return "${" + printSchemaNode(child) + "}";
        })
        .join("")}\``;

    default:
      const gottaCatchEmAll: never = schema;
      throw new Error(`Unsupported schema kind ${(schema as any).kind}`);
  }
}
