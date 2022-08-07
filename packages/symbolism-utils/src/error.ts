import { dumpNode } from "@symbolism/ts-debug";
import ts from "typescript";

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

    super(`${message} for ${dump}`);

    if ((cause as any)?.isNodeError) {
      return cause as NodeError;
    }

    if (cause) {
      (this as any).cause = cause;

      if (isRunningInJest()) {
        // Jest will not show the cause in the stack trace.
        this.stack = this.stack + "\n\nCaused by: " + cause.stack;
      }
    }
  }
}

// https://stackoverflow.com/a/52231746/238459
function isRunningInJest() {
  return process.env.JEST_WORKER_ID !== undefined;
}
