import { Command } from "commander";
import { getCliConfig } from "@symbolism/utils";
import {
  evaluateCoverage,
  findCoverageLocations,
  parseExecutedCoverage,
  printResults,
} from "@symbolism/coverage";

export function initAssert(program: Command) {
  program.command("assert").action(assert);
}

export function assert() {
  const config = getCliConfig();
  const executedCoverage = parseExecutedCoverage(config.coverageJsonPath);

  const { requiredBySymbol } = findCoverageLocations(config);

  const { coveragePercentage } = evaluateCoverage(
    requiredBySymbol,
    executedCoverage
  );

  const hasMissing = printResults(coveragePercentage);
  if (hasMissing) {
    process.exit(1);
  }
}
