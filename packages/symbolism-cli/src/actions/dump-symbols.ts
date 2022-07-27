import { Command, OptionValues } from "commander";
import { resolve } from "path";
import invariant from "tiny-invariant";
import {
  extractSymbolSummary,
  filterSymbolsToFile,
  parseSymbolTable,
} from "@symbolism/symbol-table";
import { getCliConfig, initTypescript } from "@symbolism/utils";

export function initDumpSymbols(program: Command) {
  program
    .command("dumpSymbols")
    .action(dumpSymbols)
    .option("-f, --file <file>", "Filter to symbols defined in file");
}

function dumpSymbols(opts: OptionValues) {
  const config = getCliConfig();
  const services = initTypescript(config);
  const program = services.getProgram();
  if (!program) {
    throw new Error("Failed to create program");
  }

  const symbols = filterSymbolsToFile(
    parseSymbolTable(program, config),
    resolve(opts.file)
  );

  const summary = extractSymbolSummary(symbols, program.getTypeChecker());
  summary.forEach((symbol) => {
    invariant(symbol.size > 0, "Symbol has no size");
    console.log(symbol.path + ": " + symbol.size);
  });
}
