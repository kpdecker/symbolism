import { Command, OptionValues } from "commander";
import invariant from "tiny-invariant";
import {
  extractSymbolSummary,
  filterSymbolsToFile,
  parseSymbolTable,
} from "@noom-symbolism/symbol-table";
import { getCliConfig, initTypescript } from "@noom-symbolism/utils";
import { pathMatchesTokenFilter } from "@noom-symbolism/paths";

export function initDumpSymbols(program: Command) {
  program
    .command("dumpSymbols")
    .action(dumpSymbols)
    .option("-f, --file <file>", "Filter to symbols defined in file")
    .option("-p, --path <symbolPath>", "Filter to symbols with path matcher");
}

function dumpSymbols(opts: OptionValues) {
  const config = getCliConfig();
  const services = initTypescript(config, opts.file);
  const program = services.getProgram();
  if (!program) {
    throw new Error("Failed to create program");
  }

  const checker = program.getTypeChecker();

  const symbols = filterSymbolsToFile(
    parseSymbolTable(program, config),
    opts.file
  );

  const summary = extractSymbolSummary(symbols, checker);
  summary.forEach((symbol) => {
    invariant(symbol.size > 0, "Symbol has no size");
    if (opts.path) {
      if (!pathMatchesTokenFilter(symbol.path, opts.path)) {
        return;
      }
    }

    console.log(symbol.path + ": " + symbol.size);
  });
}
