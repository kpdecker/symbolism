import { Command, OptionValues } from "commander";
import { getCliConfig, initTypescript } from "@noom/symbolism-utils";
import { findSymbol, parseSymbolTable } from "@noom/symbolism-symbol-table";
import {
  CallContext,
  loadFunctionCall,
  loadFunctionCalls,
  printCalls,
} from "@noom/symbolism-type-eval";
import { nodeFromCLI } from "../arg-parser";
import ts, { findAncestor } from "typescript";
import { defineSymbol } from "@noom/symbolism-definitions";
import invariant from "tiny-invariant";

export function initCallInputs(program: Command) {
  program
    .command("callInputs")
    .argument(
      "<symbolPath>",
      "Name of the symbol to analyze. " +
        "These can be found via the dump-symbols command. " +
        "When the file option is passed, this value may also " +
        "be a string in the form of ':line:column' "
    )
    .option("-f, --file <file>", "Filter to symbols defined in file")
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

  const node = nodeFromCLI(program, symbolPath, options);
  if (!node) {
    throw new Error(`Unable to find symbol ${symbolPath}`);
  }

  const callExpression = findAncestor(node, ts.isCallExpression);

  if (callExpression) {
    const definition = defineSymbol(callExpression.expression, checker);
    const symbol = definition?.symbol;
    invariant(symbol, "Definition must have a symbol");

    const argumentTypes = loadFunctionCall(
      callExpression,
      new CallContext(symbol, symbols, checker, {})
    );

    console.log(printCalls(argumentTypes));
  } else {
    const symbol = findSymbol(symbols, symbolPath, options.file, checker);

    const argumentTypes = loadFunctionCalls(
      symbol,
      new CallContext(symbol, symbols, checker, {})
    );

    console.log(printCalls(argumentTypes));
  }
}
