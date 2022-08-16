import { dumpSchema } from "@symbolism/ts-debug";
import { format } from "prettier";
import ts from "typescript";
import type { AnySchemaNode } from "../schema";
import { binaryExpressionOperatorToken } from "../value-eval/binary-expression";

export function printSchema(
  schema: AnySchemaNode,
  target: "ts" | "js" = "ts"
): string {
  return safeTypeFormat(printSchemaNode(schema, target), schema);
}

function safeTypeFormat(unformattedText: string, schema: AnySchemaNode) {
  try {
    return format("type foo = " + unformattedText, {
      parser: "typescript",
    }).replace(/^type foo =\s*\|?/m, "");
  } catch (err) {
    console.log(dumpSchema(schema));
    console.log(err);
    // console.log(unformattedText);
    return unformattedText;
  }
}

export function printSchemaNode(
  schema: AnySchemaNode,
  target: "ts" | "js" = "ts"
): string {
  function wrapTsType(type: string): string {
    if (target === "js") {
      const formattedType = safeTypeFormat(convertToTemplate(type), schema);
      const trimmedType = formattedType.trim().replace(/;\$/m, "");

      return trimmedType;
    }
    return type;
  }

  switch (schema.kind) {
    case "primitive":
      return wrapTsType(schema.name);
    case "literal":
      if (typeof schema.value === "string") {
        return JSON.stringify(schema.value);
      }
      if (typeof schema.value === "bigint") {
        return `${schema.value}n`;
      }
      return schema.value + "";
    case "array":
      return wrapTsType(`(${printSchemaNode(schema.items, "ts")})[]`);
    case "tuple":
      return `[${schema.items
        .map((item, i) => {
          const elementFlags = schema.elementFlags[i];
          const isRest = elementFlags & ts.ElementFlags.Rest;
          const isOptional = elementFlags & ts.ElementFlags.Optional;

          return (
            (isRest ? "..." : "") +
            printSchemaNode(item, "ts") +
            (isRest ? "[]" : "") +
            (isOptional ? "?" : "")
          );
        })
        .join(", ")}]`;
    case "object":
      const keys = Object.keys(schema.properties);
      if (keys.length === 1 && schema.abstractIndexKeys.length === 0) {
        return `({ ${JSON.stringify(keys[0])}: ${printSchemaNode(
          schema.properties[keys[0]],
          target
        )} })`;
      }
      return (
        "({\n" +
        Object.keys(schema.properties)
          .sort()
          .map((name) => {
            const property = schema.properties[name];
            return `  ${JSON.stringify(name)}: ${printSchemaNode(
              property,
              target
            )},`;
          })
          .join("\n") +
        "\n" +
        schema.abstractIndexKeys
          .map(({ key, value }) => {
            if (target === "ts") {
              return `  [k: ${printSchemaNode(key, target)}]: ${printSchemaNode(
                value,
                target
              )},`;
            }
            return `  [${printSchemaNode(key, target)}]: ${printSchemaNode(
              value,
              target
            )},`;
          })
          .join("\n") +
        "})"
      );
    case "function":
      const typeString = `((${schema.parameters
        .map(({ name, schema }) => `${name}: ${printSchemaNode(schema, "ts")}`)
        .join(", ")}) => ${printSchemaNode(schema.returnType, "ts")})`;
      return wrapTsType(typeString);
    case "binary-expression":
      return `\`${templateVar(
        schema.items[0],
        target,
        true
      )} ${binaryExpressionOperatorToken(schema.operator)} ${templateVar(
        schema.items[1],
        target,
        true
      )}\``;
    case "index":
      return wrapTsType(`keyof ${printSchemaNode(schema.type, "ts")}`);
    case "index-access":
      return wrapTsType(
        `${printSchemaNode(schema.object, target)}[${printSchemaNode(
          schema.index,
          "ts"
        )}]`
      );
    case "error":
      // console.log(schema, new Error().stack);
      return JSON.stringify("error! " + schema.extra);
    case "union":
    case "intersection":
      const separator = schema.kind === "union" ? " | " : " & ";
      return wrapTsType(
        `(${schema.items
          .map((item) => templateVar(item, "ts", target === "js"))
          .sort()
          .join(separator)})`
      );
    case "template-literal":
      return wrapTsType(
        `\`${schema.items
          .map((child) => templateVar(child, "ts", true))
          .join("")}\``
      );

    default:
      const gottaCatchEmAll: never = schema;
      throw new Error(`Unsupported schema kind ${(schema as any).kind}`);
  }
}

function convertToTemplate(text: string) {
  return "`" + unescapeTemplate(text) + "`";
}
function escapeTemplate(text: string) {
  return text.replace(/[`$\\]/g, "\\$&");
}
function unescapeTemplate(text: string) {
  if (text.startsWith("`") && text.endsWith("`")) {
    return text.replace(/^`|`$/g, "").replace(/\\([`$\\])/g, "$1");
  } else {
    return text;
  }
}

function templateVar(
  child: AnySchemaNode,
  target: "ts" | "js",
  forTemplate: boolean
): string {
  if (child.kind === "literal" && forTemplate) {
    return escapeTemplate(child.value + "");
  }
  if (
    (child.kind === "template-literal" || child.kind === "binary-expression") &&
    forTemplate
  ) {
    return printSchemaNode(child, target).replace(/^`|`$/g, "");
  }
  if (forTemplate) {
    return "${" + printSchemaNode(child, target) + "}";
  }
  return printSchemaNode(child, target);
}