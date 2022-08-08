import { getSymbolDeclaration } from "@symbolism/ts-utils";
import { resolve } from "path";
import { SymbolTable } from "./index";

export function filterSymbolsToFile(symbols: SymbolTable, fileName: string) {
  if (!fileName) {
    return symbols;
  }

  const resolvedFileName = resolve(fileName);

  const filteredSymbols = new SymbolTable();

  symbols.forEach((references, symbol) => {
    let symbolFileName = resolve(
      getSymbolDeclaration(symbol)!.getSourceFile().fileName
    );

    if (symbolFileName.includes("node_modules")) {
      symbolFileName = symbolFileName.replace(/.*\/node_modules\//g, "");
    }

    if (symbolFileName === resolvedFileName || symbolFileName === fileName) {
      filteredSymbols.set(symbol, references);
    }
  });

  return filteredSymbols;
}
