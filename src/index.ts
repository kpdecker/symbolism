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
