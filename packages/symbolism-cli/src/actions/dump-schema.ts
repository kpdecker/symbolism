import { Command, OptionValues } from "commander";
import { resolve } from "path";
import ts from "typescript";
import {
  convertTSTypeToSchema,
  createJsonSchema,
  printSchema,
  SchemaContext,
} from "@symbolism/type-eval";
import { getSymbolDeclaration } from "@symbolism/ts-utils";
import { getCliConfig, initTypescript } from "@symbolism/utils";
import { format } from "prettier";

export function initDumpSchema(program: Command) {
  program
    .command("dumpSchema <filePath> <symbolName>")
    .option("--json <namespace>", "Output json schema to std out")
    .option("--comment <namespace>", "Comment to include in json schema")
    .action(dumpSchema);
}

function dumpSchema(
  filePath: string,
  symbolName: string,
  options: OptionValues
) {
  const config = getCliConfig();
  const services = initTypescript(config, filePath);
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

  const schema = convertTSTypeToSchema(
    type,
    new SchemaContext(exportDeclaration, checker)
  );

  console.log(
    options.json
      ? format(
          `(${JSON.stringify(
            createJsonSchema({
              $id: options.json,
              $comment: options.comment,
              schema,
            })
          )})`
        )
      : printSchema(schema)
  );
}
