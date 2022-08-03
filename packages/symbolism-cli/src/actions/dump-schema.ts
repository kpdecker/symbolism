import { Command } from "commander";
import { resolve } from "path";
import ts from "typescript";
import {
  convertTSTypeToSchema,
  printSchema,
  SchemaContext,
} from "@symbolism/type-eval";
import { getSymbolDeclaration } from "@symbolism/ts-utils";
import { getCliConfig, initTypescript } from "@symbolism/utils";

export function initDumpSchema(program: Command) {
  program.command("dumpSchema <filePath> <symbolName>").action(dumpSchema);
}

function dumpSchema(filePath: string, symbolName: string) {
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
  const exportDeclaration = getSymbolDeclaration(exportSymbol)!;
  const type = checker.getTypeAtLocation(exportDeclaration);

  console.log(
    printSchema(
      convertTSTypeToSchema(type, new SchemaContext(exportDeclaration, checker))
    )
  );
}
