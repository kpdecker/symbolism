#!/bin/env ts-node
import { program } from "commander";
import chalk from "chalk";

import { parseConfig } from "./config";
import { isLocationCovered, parseCoverage } from "./coverage";
import { findCoverageLocations } from "./parser";
import { relative } from "path";
import ts from "typescript";

program.option("-c, --config <path>", "config file path", "./.token-cov.json");
program.argument("<coverage json path>", "Coverage json file");

program.parse();

const opts = program.opts();

const config = parseConfig(opts.config);
const coverageJson = parseCoverage(program.args[0]);

const { symbolCoverageLocations } = findCoverageLocations(config);

const coverageLocations = symbolCoverageLocations;
const uncoveredLocations = Object.entries(coverageLocations).reduce(
  (acc, [keyName, locations]) => {
    const uncoveredLocations = locations.filter(
      (location) =>
        !isLocationCovered(coverageJson, location.fileName, location)
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
