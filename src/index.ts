#!/bin/env ts-node
import { Command, OptionValues, program } from "commander";
import { relative } from "path";

import { Config, parseConfig } from "./config";
import { evaluateCoverage, parseExecutedCoverage } from "./coverage";
import { findCoverageLocations } from "./parser";
import { printResults } from "./reporter";
import { extractSymbolSummary, parseSymbolTable } from "./symbols";
import { initTypescript } from "./typescript";

let config: Config;

program.option("-c, --config <path>", "config file path", "./.token-cov.json");

program.hook("preAction", (command) => {
  const opts = command.opts();
  config = parseConfig(opts.config);
});

program.command("assert").action((opts: OptionValues) => {
  const executedCoverage = parseExecutedCoverage(config.coverageJsonPath);

  const { requiredBySymbol } = findCoverageLocations(config);

  const { coveragePercentage } = evaluateCoverage(
    requiredBySymbol,
    executedCoverage
  );

  printResults(coveragePercentage);
});

program.command("dumpFiles").action((opts: OptionValues, command: Command) => {
  const services = initTypescript(config);
  services
    .getProgram()!
    .getSourceFiles()
    .map((sourceFile) => sourceFile.fileName)
    .filter((fileName) => !config.exclude(fileName))
    .sort()
    .forEach((fileName) => {
      console.log(relative(config.baseDir, fileName));
    });
});

program.parse();
