import { readFileSync } from "fs";
import { LineAndCharacter } from "typescript";
import { CoverageRequiredListing } from "./parser";

export type LineAndColumn = { line: number; column: number };

type StatementCoverage = {
  start: LineAndColumn;
  end: LineAndColumn;
  count: number;
};

type ExecutedCoverage = Record</** filePath */ string, StatementCoverage[]>;

export function lineAndColumn(lineAndChar: LineAndCharacter) {
  return { line: lineAndChar.line + 1, column: lineAndChar.character };
}

export function parseCoverage(coveragePath: string) {
  const rawCoverageJson = JSON.parse(readFileSync(coveragePath, "utf8"));
  const coverageJson: ExecutedCoverage = {};

  Object.entries<any>(rawCoverageJson).forEach(
    ([filePath, { statementMap, s: statementCoverage }]) => {
      coverageJson[filePath] = Object.entries<any>(statementMap).map(
        ([id, { start, end }]) => ({
          start,
          end,
          count: statementCoverage[id],
        })
      );
    }
  );

  return coverageJson;
}

export function evaluateCoverage(
  coverageLocations: CoverageRequiredListing,
  executedCoverage: ExecutedCoverage
) {
  const uncoveredLocations = Object.entries(coverageLocations).reduce(
    (acc, [keyName, locations]) => {
      const uncoveredLocations = locations.filter(
        (location) =>
          !isLocationCovered(executedCoverage, location.fileName, location)
      );
      if (uncoveredLocations.length) {
        acc[keyName] = uncoveredLocations;
      }
      return acc;
    },
    {} as typeof coverageLocations
  );

  const coveragePercentage = Object.entries(coverageLocations).reduce(
    (acc, [keyName, locations]) => {
      const coverageNeeded = locations.length;
      const coverageMissing = uncoveredLocations[keyName]?.length ?? 0;
      acc[keyName] = {
        covered: coverageNeeded - coverageMissing,
        total: coverageNeeded,
        locations: uncoveredLocations[keyName],
      };
      return acc;
    },
    {} as Record<
      string,
      { covered: number; total: number; locations: typeof coverageLocations[0] }
    >
  );

  return { coveragePercentage, uncoveredLocations };
}

export function isLocationCovered(
  coverageJson: Record</** filePath */ string, StatementCoverage[]>,
  filePath: string,
  { line, column }: LineAndColumn
) {
  const statements = coverageJson[filePath];
  if (!statements) {
    return false;
  }

  const statement = statements.find(
    ({ start, end }) =>
      // Lines
      start.line <= line &&
      line <= end.line &&
      // Columns
      start.column <= column &&
      column <= end.column
  );

  return !!statement?.count;
}
