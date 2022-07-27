import ts from "typescript";
import { findNodeInTree } from "@symbolism/ts-utils";
import { defineSymbol } from "../src/index";
import { dumpSymbol } from "@symbolism/ts-debug";
import { mockProgram } from "@symbolism/test";

export function testStatement(source: string) {
  const program = mockProgram({
    "test.ts": source + ";",
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile("test.ts")!;
  const node = sourceFile.statements[0];

  return dumpInferred(defineSymbol(node, checker)!, checker);
}

export function testExpression(source: string) {
  const program = mockProgram({
    "test.ts": "var bar = " + source + ";",
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile("test.ts")!;
  const node = findNodeInTree(sourceFile, ts.isVariableDeclaration);

  return dumpInferred(defineSymbol(node?.initializer!, checker)!, checker);
}
export function dumpInferred(
  inferred: ReturnType<typeof defineSymbol>,
  checker: ts.TypeChecker
) {
  if (!inferred) {
    return inferred;
  }
  const symbol = dumpSymbol(inferred!.symbol, checker);
  const declarations = symbol.declaration.map((x) => {
    return {
      ...x,
      fileName: x.fileName.includes("node_modules")
        ? x.fileName.replace(/.*\/node_modules\//, "")
        : x.fileName,
    };
  });
  return {
    type: checker.typeToString(inferred?.type!),
    symbol: declarations,
  };
}
