import * as ts from "typescript";
import { existsSync, readFileSync } from "fs";
import { Config } from "./config";
import { getNodeAtPosition, getSymbolForModuleLike } from "./utils";
import { initTypescript } from "./typescript";
import { dumpSymbolTable, parseSymbolTable } from "./symbols";
import { lineAndColumn, LineAndColumn } from "./coverage";

type TokenSourceLocation = {
  kind: ts.SyntaxKind;
  token: string;

  fileName: string;
  start: number;
  length: number;
} & LineAndColumn;

export function findCoverageLocations(config: Config) {
  const services = initTypescript(config);
  const program = services.getProgram();
  if (!program) {
    throw new Error("Failed to create program");
  }

  const symbols = parseSymbolTable(program, services, config);
}
