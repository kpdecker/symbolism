import { Command } from "commander";
import { getCliConfig } from "../config";
import { evaluateCoverage, parseExecutedCoverage } from "../coverage";
import { findCoverageLocations } from "../parser";
import { printResults } from "../reporter";

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
