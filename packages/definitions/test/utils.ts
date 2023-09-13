import ts from "typescript";
import { findNodeInTree } from "@noom/symbolism-ts-utils";
import { defineSymbol } from "../src/index";
import { dumpDefinition } from "@noom/symbolism-ts-debug";
import { mockProgram } from "@noom/symbolism-test";
import { assertExists } from "@noom/symbolism-utils";

export { mockProgram } from "@noom/symbolism-test";

export function testStatement(source: string) {
  const program = mockProgram({
    "test.ts": source + ";",
  });
  const checker = program.getTypeChecker();
  const sourceFile = assertExists(program.getSourceFile("test.ts"));
  const node = sourceFile.statements[0];

  return dumpDefinition(
    defineSymbol(node, checker, { chooseLocal: false }),
    checker
  );
}

export function testExpression(source: string) {
  const program = mockProgram({
    "test.ts": "var bar = " + source + ";",
  });
  const checker = program.getTypeChecker();
  const sourceFile = assertExists(program.getSourceFile("test.ts"));
  const node = findNodeInTree(sourceFile, ts.isVariableDeclaration);

  return dumpDefinition(
    defineSymbol(node?.initializer, checker, { chooseLocal: false }),
    checker
  );
}
