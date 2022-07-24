import { resolve } from "path";
import { SymbolTable } from "./symbols";
import { getSymbolDeclaration } from "./utils";

export function filterSymbolsToFile(symbols: SymbolTable, fileName: string) {
  if (!fileName) {
    return symbols;
  }

  const filteredSymbols: SymbolTable = new Map();

  symbols.forEach((references, symbol) => {
    const symbolFileName = resolve(
      getSymbolDeclaration(symbol)!.getSourceFile().fileName
    );

    if (symbolFileName === fileName) {
      filteredSymbols.set(symbol, references);
    }
  });

  return filteredSymbols;
}
