import { readFileSync } from "fs";
import invariant from "tiny-invariant";
import { LineAndCharacter } from "typescript";
import { CoverageRequiredListing } from "./parser";

export type LineAndColumn = { line: number; column: number };

type CoverageEntry = {
  start: LineAndColumn;
  end: LineAndColumn;
  count: number;
};

type ExecutedCoverage = Record<
  /** filePath */ string,
  {
    statements: CoverageEntry[];
    branches: CoverageEntry[];
  }
>;

export function lineAndColumn(lineAndChar: LineAndCharacter) {
  // Return 1 index for both
  return { line: lineAndChar.line + 1, column: lineAndChar.character + 1 };
}

export function parseExecutedCoverage(jsonPath: string) {
  const rawCoverageJson = JSON.parse(readFileSync(jsonPath, "utf8"));
  const coverageJson: ExecutedCoverage = {};

  Object.entries<any>(rawCoverageJson).forEach(
    ([
      filePath,
      {
        statementMap,
        s: statementCoverage,
        branchMap,
        b: branchCoverage,
      },
    ]) => {
      const branchDeclarations = Object.values<any>(branchMap)
        .flatMap(({ locations }, id) => {
          return locations.map((location: any, locationIndex: number) => ({
            ...parseCoverageLocation(location),
            count: branchCoverage[id][locationIndex],
          }));
        })
        .sort(reverseLocationPriority);

      coverageJson[filePath] = {
        statements: Object.entries<any>(statementMap)
          .map(([id, { start, end }]) => ({
            ...parseCoverageLocation({ start, end }),
            count: statementCoverage[id],
          }))
          .sort(reverseLocationPriority),
        branches: branchDeclarations,
      };
    }
  );

  return coverageJson;
}

function reverseLocationPriority(a: CoverageEntry, b: CoverageEntry) {
  // Sort bottom up to account for nested coverage
  return b.start.line - a.start.line || b.start.column - a.start.column;
}

function parseCoverageLocation({
  start,
  end,
}: {
  start: LineAndColumn;
  end: LineAndColumn;
}) {
  return {
    start: {
      line: start.line,
      column: start.column || 0, // null column = whole line
    },
    end: {
      line: end.line,
      column: end.column || Infinity,
    },
  };
}

export function evaluateCoverage(
  coverageLocations: CoverageRequiredListing,
  executedCoverage: ExecutedCoverage
) {
  const uncoveredLocations = Object.entries(coverageLocations).reduce(
    (acc, [keyName, locations]) => {
      const uncoveredLocations = locations.filter(
        (location) =>
          // Filter input locations to those that are instrumented
          locationInstrumentation(
            executedCoverage,
            location.fileName,
            location
          ) && !isLocationCovered(executedCoverage, location.fileName, location)
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

export function locationInstrumentation(
  coverageJson: ExecutedCoverage,
  filePath: string,
  { line, column }: LineAndColumn
) {
  const { statements, branches } = coverageJson[filePath] || {};

  // Branches are smaller than statements, so we need to check them first
  return (
    branches?.find(isLocationInEntry) ?? statements?.find(isLocationInEntry)
  );

  function isLocationInEntry({ start, end }: CoverageEntry) {
    return (
      // Lines
      start.line <= line &&
      line <= end.line &&
      // Columns
      start.column <= column &&
      column <= end.column
    );
  }
}

export function isLocationCovered(
  coverageJson: ExecutedCoverage,
  filePath: string,
  { line, column }: LineAndColumn
) {
  const statement = locationInstrumentation(coverageJson, filePath, {
    line,
    column,
  });

  return !!statement?.count;
}
