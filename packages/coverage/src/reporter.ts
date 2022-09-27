import type { evaluateCoverage } from "./coverage";
import chalk from "chalk";
import { relative } from "path";

export function printResults(
  coveragePercentage: ReturnType<typeof evaluateCoverage>["coveragePercentage"]
) {
  let hasMissing = false;

  // const log = ((...args: any[]) => {});
  const log = console.error;
  Object.keys(coveragePercentage).forEach((keyName) => {
    const { covered, total, locations } = coveragePercentage[keyName];
    log(
      `${chalk[covered < total ? "red" : "green"](keyName)}: ${(
        (covered / total) *
        100
      ).toFixed(2)}% covered (${covered}/${total})`
    );
    if (locations) {
      hasMissing = true;

      log(`  Missing:`);

      locations
        .sort((a, b) => a.fileName.localeCompare(b.fileName) || a.line - b.line)
        .map((location) => {
          log(
            `    ${location.text}: ${chalk.blue(
              "./" + relative(process.cwd(), location.fileName)
            )}:${chalk.yellow(location.line)}:${chalk.yellow(location.column)}`
          );
        });
    }
    log();
  });

  return hasMissing;
}
