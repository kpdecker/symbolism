import { Command, OptionValues } from "commander";
import { getCliConfig, initTypescript } from "@symbolism/utils";
import { findSymbol, parseSymbolTable } from "@symbolism/symbol-table";
import {
  CallContext,
  loadFunctionCalls,
  printCalls,
} from "@symbolism/type-eval";

export function initCallInputs(program: Command) {
  program
    .command("callInputs <symbolPath>")
    .action(callInputs)
    .option("-f, --file <file>", "Filter to symbols defined in file");
}

export function callInputs(symbolPath: string, options: OptionValues) {
  // TODO: Exclude tests from responses
  const config = getCliConfig();
  const services = initTypescript(config);
  const program = services.getProgram();
  if (!program) {
    throw new Error("Failed to create program");
  }

  const checker = program.getTypeChecker();
  const symbols = parseSymbolTable(program, config);

  const symbol = findSymbol(symbols, symbolPath, options.file, checker);

  const argumentTypes = loadFunctionCalls(
    symbol,
    new CallContext(symbol, symbols, checker)
  );

  console.log(printCalls(argumentTypes));
}
