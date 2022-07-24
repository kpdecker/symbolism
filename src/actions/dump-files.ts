import { Command } from "commander";
import { relative } from "path";
import { getCliConfig } from "../config";
import { initTypescript } from "../typescript";

export function initDumpFiles(program: Command) {
  program.command("dumpFiles").action(dumpFiles);
}

export function dumpFiles() {
  const config = getCliConfig();
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
}
