import { readFileSync } from 'fs';
import { LineAndCharacter } from 'typescript';

export type LineAndColumn = { line: number; column: number };

type StatementCoverage = {
  start: LineAndColumn;
  end: LineAndColumn;
  count: number;
};

export function lineAndColumn(lineAndChar: LineAndCharacter) {
  return { line: lineAndChar.line + 1, column: lineAndChar.character };
}

export function parseCoverage(coveragePath: string) {
  const rawCoverageJson = JSON.parse(readFileSync(coveragePath, 'utf8'));
  const coverageJson: Record</** filePath */ string, StatementCoverage[]> = {};

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
