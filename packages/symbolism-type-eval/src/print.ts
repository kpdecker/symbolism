import { format } from "prettier";
import invariant from "tiny-invariant";
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
    case "number":
      return "number";
    case "string":
      return "string";
    case "any":
    case "never":
      return schema.kind;
    case "literal":
      invariant("value" in schema);
      return typeof schema.value === "string"
        ? `"${schema.value}"`
        : schema.value + "";
    case "array":
      invariant("items" in schema);
      return `(${printSchemaNode(schema.items)})[]`;
    case "tuple":
      invariant("items" in schema);
      return `[${schema.items.map(printSchemaNode).join(", ")}]`;
    case "object":
      invariant("properties" in schema);

      const keys = Object.keys(schema.properties);
      if (keys.length === 1) {
        return `{ ${keys[0]}: ${printSchemaNode(schema.properties[keys[0]])} }`;
      }

      return (
        "{\n" +
        printString(
          Object.keys(schema.properties)
            .sort()
            .map((name) => {
              const property = schema.properties[name];
              return `  ${name}: ${printSchemaNode(property)},`;
            })
            .join("\n")
        ) +
        "}"
      );
    case "error":
      console.log(schema);
      return " // error! " + schema.extra;
    case "union":
    case "intersection":
      invariant("items" in schema);
      const separator = schema.kind === "union" ? "\n  | " : "\n  & ";
      return `
  ${separator} ${printString(
        schema.items.map(printSchemaNode).sort().join(separator)
      )}`;
    default:
      const gottaCatchEmAll: never = schema;
      throw new Error(`Unsupported schema kind ${(schema as any).kind}`);
  }
}
