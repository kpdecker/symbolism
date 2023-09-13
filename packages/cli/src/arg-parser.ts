import { findSymbol, parseSymbolTable } from "@noom/symbolism-symbol-table";
import { getNodeAtPosition, getSymbolDeclaration } from "@noom/symbolism-ts-utils";
import { getCliConfig } from "@noom/symbolism-utils";
import { OptionValues } from "commander";
import { resolve } from "path";
import ts from "typescript";

function safeGetPosition(
  sourceFile: ts.SourceFile,
  line: number,
  column: number
) {
  const lineStarts = sourceFile.getLineStarts();
  const lineStart = lineStarts[line];
  if (line < 0 || line >= lineStarts.length) {
    throw new Error(
      `Line number ${line + 1} out of range. Lines in file: ${
        lineStarts.length + 1
      }`
    );
  }

  const lineEnd = sourceFile.getLineEndOfPosition(lineStarts[line]);
  if (column < 0 || lineStart + column > lineEnd) {
    throw new Error(
      `Column number ${column + 1} out of range. Columns in line ${line + 1}: ${
        lineEnd - lineStart + 1
      }`
    );
  }

  return sourceFile.getPositionOfLineAndCharacter(line, column);
}

export function nodeFromCLI(
  program: ts.Program,
  symbolPath: string,
  options: OptionValues
) {
  const checker = program.getTypeChecker();

  if (options.file) {
    const sourceFile = program.getSourceFile(resolve(options.file));
    if (!sourceFile) {
      throw new Error(`Unable to find file ${options.file}`);
    }

    if (/^:(\d+):(\d+)$/.exec(symbolPath)) {
      const line = parseInt(RegExp.$1, 10) - 1;
      const col = parseInt(RegExp.$2, 10) - 1;
      const node = getNodeAtPosition(
        sourceFile,
        safeGetPosition(sourceFile, line, col)
      );
      return node;
    } else {
      const allSymbols = checker.getSymbolsInScope(
        sourceFile,
        ts.SymbolFlags.Type | ts.SymbolFlags.Interface | ts.SymbolFlags.Value
      );
      const symbol = allSymbols.find(
        (needle) => needle.getName() === symbolPath
      );
      return getSymbolDeclaration(symbol);
    }
  } else {
    const config = getCliConfig();
    const symbols = parseSymbolTable(program, config);

    const symbol = findSymbol(symbols, symbolPath, undefined, checker);
    return getSymbolDeclaration(symbol);
  }
}
