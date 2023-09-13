import { assertExists, getCliConfig, initTypescript } from "@noom/symbolism-utils";
import { Command } from "commander";
import { relative } from "path";

export function initDumpFiles(program: Command) {
  program.command("dumpFiles").action(dumpFiles);
}

export function dumpFiles() {
  const config = getCliConfig();
  const services = initTypescript(config);
  assertExists(services.getProgram())
    .getSourceFiles()
    .map((sourceFile) => sourceFile.fileName)
    .filter((fileName) => !config.exclude(fileName))
    .sort()
    .forEach((fileName) => {
      console.log(relative(config.baseDir, fileName));
    });
}
