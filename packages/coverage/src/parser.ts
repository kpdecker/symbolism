import * as ts from "typescript";
import { parseSymbolTable } from "@symbolism/symbol-table";
import { getNodePath, pathMatchesTokenFilter } from "@symbolism/paths";
import { Config, initTypescript } from "@symbolism/utils";
import { getSymbolDeclaration, LineAndColumn } from "@symbolism/ts-utils";
import { dumpNode } from "@symbolism/ts-debug";
import invariant from "tiny-invariant";

export type TokenSourceLocation = {
  kind: ts.SyntaxKind;
  definitionPath: string;
  token: string;

  fileName: string;
  start: number;
  length: number;
  text: string;
} & LineAndColumn;

export type CoverageRequiredListing = Record<string, TokenSourceLocation[]>;

export function findCoverageLocations(config: Config) {
  const services = initTypescript(config);
  const program = services.getProgram();
  if (!program) {
    throw new Error("Failed to create program");
  }

  const checker = program.getTypeChecker();

  const allReferences = parseSymbolTable(program, config);

  const coverageRequired: TokenSourceLocation[] = [];

  allReferences.forEach((referencingNodes, symbol) => {
    const symbolPath = getNodePath(getSymbolDeclaration(symbol), checker);
    if (
      config.tokens.some(({ name }) => pathMatchesTokenFilter(symbolPath, name))
    ) {
      referencingNodes.forEach((referencingNode) => {
        const node = dumpNode(referencingNode, checker);
        invariant(node, "Failed to dump node");

        const [fileName, line, column] = node.location.split(":");

        coverageRequired.push({
          kind: referencingNode.parent.kind,
          definitionPath: symbolPath,
          token: node.path,
          fileName,
          start: referencingNode.pos,
          length: referencingNode.end - referencingNode.pos,

          text: node.name,

          line: parseInt(line, 10),
          column: parseInt(column, 10),
        });
      });
    }
  });

  const requiredByFile: CoverageRequiredListing = {};
  coverageRequired.forEach((coverageRequired) => {
    requiredByFile[coverageRequired.fileName] =
      requiredByFile[coverageRequired.fileName] || [];
    requiredByFile[coverageRequired.fileName].push(coverageRequired);
  });

  const requiredBySymbol: CoverageRequiredListing = {};
  coverageRequired.forEach((coverageRequired) => {
    requiredBySymbol[coverageRequired.token] =
      requiredBySymbol[coverageRequired.token] || [];
    requiredBySymbol[coverageRequired.token].push(coverageRequired);
  });

  return { requiredByFile, requiredBySymbol };
}
