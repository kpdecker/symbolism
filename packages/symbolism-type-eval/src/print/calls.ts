import { dumpSchema } from "@symbolism/ts-debug";
import { format } from "prettier";
import { FunctionCallInfo } from "../calls";
import { canPrintInJs, isConcreteSchema, SchemaError } from "../classify";
import { printSchema, printSchemaNode } from "./typescript";

export function printCalls(calls: FunctionCallInfo[]) {
  const unformattedText = calls
    .map((call) => {
      const unformattedText = printCall(call);
      try {
        return format(unformattedText, { parser: "typescript" });
      } catch (err: any) {
        throw new SchemaError(
          err.message + "\n\nUnformatted: " + unformattedText,
          call.arguments
        );
      }
    })
    .sort((a, b) =>
      // Normalize for sorting
      a
        .replace(/\(\s+/g, "(")
        .replace(/['`]/g, '"')
        .replace(/arg as\b/g, "")

        .toLowerCase()
        .localeCompare(
          b
            .replace(/\(\s+/g, "(")
            .replace(/['`]/g, '"')
            .replace(/arg as\b/g, "")
            .toLowerCase()
        )
    )
    .join("");

  return format(unformattedText, {
    parser: "typescript",
  });
}
function printCall(call: FunctionCallInfo) {
  return `${call.callExpression.expression.getText()}(${call.arguments
    .map((item) => {
      if (!canPrintInJs(item)) {
        return `arg as ${printSchemaNode(item, "ts")}`;
      }
      return printSchemaNode(item, "js");
    })
    .join(", ")})`;
}
