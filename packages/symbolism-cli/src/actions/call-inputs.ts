import { Command } from "commander";
import { resolve } from "path";
import ts from "typescript";
import { getSymbolDeclaration } from "@symbolism/ts-utils";
import { getCliConfig, initTypescript } from "@symbolism/utils";
import { parseSymbolTable } from "@symbolism/symbol-table";
import {
  CallContext,
  loadFunctionCalls,
  printCalls,
  SchemaContext,
} from "@symbolism/type-eval";

export function initCallInputs(program: Command) {
  program
    .command("callInputs <path> <symbolName>")
    .action(callInputs)
    .option("-f, --file <file>", "Filter to symbols defined in file");
}

export function callInputs(filePath: string, symbolName: string) {
  const config = getCliConfig();
  const services = initTypescript(config);
  const program = services.getProgram();
  if (!program) {
    throw new Error("Failed to create program");
  }

  const checker = program.getTypeChecker();

  const sourceFile = program.getSourceFile(resolve(filePath));
  if (!sourceFile) {
    throw new Error(`Unable to find file ${filePath}`);
  }

  const allSymbols = checker.getSymbolsInScope(
    sourceFile,
    ts.SymbolFlags.Type | ts.SymbolFlags.Interface | ts.SymbolFlags.Value
  );
  const symbol = allSymbols.find((needle) => needle.getName() === symbolName);
  if (!symbol) {
    throw new Error(`Unable to find symbol ${symbolName}`);
  }

  const exportSymbol = checker.getExportSymbolOfSymbol(symbol);

  const symbols = parseSymbolTable(program, config);

  const argumentTypes = loadFunctionCalls(
    exportSymbol,
    new CallContext(exportSymbol, symbols, checker)
  );

  console.log(printCalls(argumentTypes));
}
