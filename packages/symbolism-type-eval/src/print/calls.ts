import { format } from "prettier";
import { FunctionCallInfo } from "../calls";
import { printSchemaNode } from "./typescript";

export function printCalls(calls: FunctionCallInfo[]) {
  const unformattedText = calls.map((call) => printCall(call)).join("\n");
  return format(unformattedText, {
    parser: "typescript",
  });
}
function printCall(call: FunctionCallInfo) {
  return `${call.callExpression.expression.getText()}(${call.arguments
    .map((item) => printSchemaNode(item, "js"))
    .join(", ")})`;
}
