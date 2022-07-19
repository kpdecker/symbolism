#!/bin/env ts-node
import { program } from "commander";

import { parseConfig } from "./config";
import { evaluateCoverage, parseCoverage } from "./coverage";
import { findCoverageLocations } from "./parser";
import { printResults } from "./reporter";

program.option("-c, --config <path>", "config file path", "./.token-cov.json");
program.argument("<coverage json path>", "Coverage json file");

program.parse();

const opts = program.opts();

const config = parseConfig(opts.config);
const coverageJson = parseCoverage(program.args[0]);

const { requiredBySymbol } = findCoverageLocations(config);

const { coveragePercentage } = evaluateCoverage(requiredBySymbol, coverageJson);

printResults(coveragePercentage);
