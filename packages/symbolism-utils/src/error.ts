import { dumpNode } from "@symbolism/ts-debug";
import ts from "typescript";

const $prepareStackTrace = Error.prepareStackTrace;
Error.prepareStackTrace = (error, stack) => {
  let result = $prepareStackTrace!(error, stack);
  if ("cause" in error && (error as any).cause) {
    result += "\n\nCaused by: " + (error as any).cause.stack;
  }
  return result;
};

export class NodeError extends Error {
  isNodeError = true;
  // cause: Error | undefined;

  constructor(
    message: string,
    node: ts.Node,
    checker: ts.TypeChecker,
    cause?: Error
  ) {
    let dump;
    try {
      dump = JSON.stringify(dumpNode(node, checker), null, 2);
    } catch (e) {
      dump = `${node.getSourceFile().fileName} ${ts.SyntaxKind[node.kind]}: ${
        node.getText().split("\n")[0]
      }`;
    }

    super(`${message}\n\nNode: ${dump}`);
    Error.captureStackTrace(this, this.constructor);

    if ((cause as any)?.isNodeError) {
      return cause as NodeError;
    }

    if (cause) {
      (this as any).cause = cause;
      try {
        // Reading here ensures that line numbers are correctly source mapped
        cause.stack;
      } catch (err) {
        /* NOP */
      }
    }
  }
}

// https://stackoverflow.com/a/52231746/238459
function isRunningInJest() {
  return process.env.JEST_WORKER_ID !== undefined;
}
