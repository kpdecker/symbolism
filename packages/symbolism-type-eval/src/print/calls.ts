import { dumpSchema } from "@symbolism/ts-debug";
import { format } from "prettier";
import { FunctionCallInfo } from "../calls";
import { isConcreteSchema } from "../classify";
import { printSchema, printSchemaNode } from "./typescript";

export function printCalls(calls: FunctionCallInfo[]) {
  const unformattedText = calls
    .map((call) => {
      return printCall(call);
    })
    .sort((a, b) =>
      // Normalize for sorting
      a
        .replace(/['`]/g, '"')
        .replace(/arg as\b/g, "")
        .toLowerCase()
        .localeCompare(
          b
            .replace(/['`]/g, '"')
            .replace(/arg as\b/g, "")
            .toLowerCase()
        )
    )
    .join("\n");

  return format(unformattedText, {
    parser: "typescript",
  });
}
function printCall(call: FunctionCallInfo) {
  return `${call.callExpression.expression.getText()}(${call.arguments
    .map((item) => {
      if (!isConcreteSchema(item)) {
        return `arg as ${printSchemaNode(item, "ts")}`;
      }
      return printSchemaNode(item, "ts");
    })
    .join(", ")})`;
}
