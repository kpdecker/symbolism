import { dumpNode } from "@noom-symbolism/ts-debug";
import ts from "typescript";

declare global {
  interface Error {
    cause?: Error;
    isNodeError?: boolean;
  }
}

const $prepareStackTrace = Error.prepareStackTrace;
Error.prepareStackTrace = (error, stack) => {
  let result =
    $prepareStackTrace?.(error, stack) ||
    `${error.name}: ${error.message}
  at ${stack.join("\n  at ")}`;

  if (error.cause) {
    result += "\n\nCaused by: " + error.cause.stack;
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

    if (cause?.isNodeError) {
      return cause as NodeError;
    }

    if (cause) {
      this.cause = cause;
      try {
        // Reading here ensures that line numbers are correctly source mapped
        cause.stack;
      } catch (err) {
        /* NOP */
      }
    }
  }
}
