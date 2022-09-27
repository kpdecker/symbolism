import { AnySchemaNode } from "./schema";

export function schemaToRegEx(schema: AnySchemaNode): RegExp {
  return new RegExp("^" + schemaToRegExString(schema) + "$");
}

function schemaToRegExString(schema: AnySchemaNode): string {
  if (schema.kind === "primitive") {
    if (schema.name === "number" || schema.name === "bigint") {
      return "-?(0|[1-9][0-9]*.?[0-9]*)";
    } else if (schema.name === "string" || schema.name === "any") {
      return ".*";
    } else if (schema.name === "boolean") {
      return "(true|false)";
    } else {
      return schema.name;
    }
  }

  if (schema.kind === "literal") {
    return escapeRegExp(`${schema.value}`);
  }

  if (schema.kind === "intersection") {
    return schema.items
      .map((item) => "(" + schemaToRegExString(item) + ")")
      .join("|");
  }
  if (schema.kind === "template-literal") {
    return schema.items.map((item) => schemaToRegExString(item)).join("");
  }

  throw new Error(`Regex pattern not supported for ${schema.kind}`);
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}
