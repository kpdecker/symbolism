import * as ts from "typescript";
import { existsSync, readFileSync } from "fs";
import { Config } from "./config";
import {
  getNodeAtPosition,
  getSymbolDeclaration,
  getSymbolForModuleLike,
} from "./utils";
import { initTypescript } from "./typescript";
import { dumpNode, dumpSymbolTable, parseSymbolTable } from "./symbols";
import { lineAndColumn, LineAndColumn } from "./coverage";
import { namedPathToNode, pathMatchesTokenFilter } from "./path/index";

type TokenSourceLocation = {
  kind: ts.SyntaxKind;
  definitionPath: string;
  token: string;

  fileName: string;
  start: number;
  length: number;
  text: string;
} & LineAndColumn;

export function findCoverageLocations(config: Config) {
  const services = initTypescript(config);
  const program = services.getProgram();
  if (!program) {
    throw new Error("Failed to create program");
  }

  const checker = program.getTypeChecker();

  const symbols = parseSymbolTable(program, services, config);
  // console.log(dumpSymbolTable(symbols));

  const coverageRequired: TokenSourceLocation[] = [];

  symbols.forEach((referencingNodes, symbol) => {
    const symbolPath = namedPathToNode(getSymbolDeclaration(symbol)!, checker);
    if (
      config.tokens.some(({ name }) => pathMatchesTokenFilter(symbolPath, name))
    ) {
      referencingNodes.forEach((referencingNode) => {
        const sourceFile = referencingNode.getSourceFile();
        const node = dumpNode(referencingNode, checker);
        const lineAndChar = sourceFile?.getLineAndCharacterOfPosition(
          referencingNode.pos
        );

        coverageRequired.push({
          kind: referencingNode.parent.kind,
          definitionPath: symbolPath,
          token: node.path,
          fileName: node.fileName,
          start: referencingNode.pos,
          length: referencingNode.end - referencingNode.pos,

          text: node.name,

          ...lineAndColumn(lineAndChar),
        });
      });
    }
  });

  const fileCoverageLocations: Record<string, TokenSourceLocation[]> = {};
  coverageRequired.forEach((coverageRequired) => {
    fileCoverageLocations[coverageRequired.fileName] =
      fileCoverageLocations[coverageRequired.fileName] || [];
    fileCoverageLocations[coverageRequired.fileName].push(coverageRequired);
  });

  const symbolCoverageLocations: Record<string, TokenSourceLocation[]> = {};
  coverageRequired.forEach((coverageRequired) => {
    symbolCoverageLocations[coverageRequired.token] =
      symbolCoverageLocations[coverageRequired.token] || [];
    symbolCoverageLocations[coverageRequired.token].push(coverageRequired);
  });

  return { fileCoverageLocations, symbolCoverageLocations };
}
