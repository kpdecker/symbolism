import { LineAndColumn } from "@noom/symbolism-ts-utils";
import { readFileSync } from "fs";
import { CoverageRequiredListing } from "./parser";

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

type FileCoverageData = {
  path: string;
  statementMap: Record<string, { start: LineAndColumn; end: LineAndColumn }>;
  s: Record<string, number>;
  branchMap: Record<
    string,
    {
      line: number;
      type: string;
      locations: { start: LineAndColumn; end: LineAndColumn }[];
    }
  >;
  b: Record<string, number[]>;
  fnMap: Record<string, { name: string; line: number }>;
};

export function parseExecutedCoverage(jsonPath: string) {
  const rawCoverageJson: Record<string, FileCoverageData> = JSON.parse(
    readFileSync(jsonPath, "utf8")
  );
  const coverageJson: ExecutedCoverage = {};

  Object.entries(rawCoverageJson).forEach(
    ([
      filePath,
      { statementMap, s: statementCoverage, branchMap, b: branchCoverage },
    ]) => {
      const branchDeclarations = Object.values(branchMap)
        .flatMap(({ locations }, id) => {
          return locations.map((location, locationIndex: number) => ({
            ...parseCoverageLocation(location),
            count: branchCoverage[id][locationIndex] || 0,
          }));
        })
        .sort(reverseLocationPriority);

      coverageJson[filePath] = {
        statements: Object.entries(statementMap)
          .map(([id, { start, end }]) => ({
            ...parseCoverageLocation({ start, end }),
            count: statementCoverage[id] || 0,
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
