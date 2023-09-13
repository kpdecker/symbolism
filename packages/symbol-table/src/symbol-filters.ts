import { getSymbolDeclaration } from "@noom-symbolism/ts-utils";
import { getNodePath, pathMatchesTokenFilter } from "@noom-symbolism/paths";

import { resolve } from "path";
import ts from "typescript";
import { SymbolTable } from "./index";
import invariant from "tiny-invariant";

export function filterSymbolsToFile(symbols: SymbolTable, fileName: string) {
  if (!fileName) {
    return symbols;
  }

  const resolvedFileName = resolve(fileName);

  const filteredSymbols = new SymbolTable();

  symbols.forEach((references, symbol) => {
    if (symbolMatchesFile(symbol, resolvedFileName)) {
      filteredSymbols.set(symbol, references);
    }
  });

  return filteredSymbols;
}

export function findSymbol(
  symbols: SymbolTable,
  symbolPath: string,
  fileName: string | undefined,
  checker: ts.TypeChecker
) {
  const resolvedFileName = fileName && resolve(fileName);

  const symbol = Array.from(symbols.keys()).find((needle) => {
    if (!symbolMatchesFile(needle, resolvedFileName)) {
      return false;
    }
    const declaration = getSymbolDeclaration(needle);
    if (!declaration) {
      return false;
    }

    const path = getNodePath(declaration, checker);
    return pathMatchesTokenFilter(path, symbolPath);
  });
  if (!symbol) {
    throw new Error(`Unable to find symbol ${symbolPath}`);
  }

  return symbol;
}

function symbolMatchesFile(symbol: ts.Symbol, fileName: string | undefined) {
  if (!fileName) {
    return true;
  }

  const declaration = getSymbolDeclaration(symbol);
  invariant(declaration, "Unable to find declaration for symbol");

  let symbolFileName = resolve(declaration.getSourceFile().fileName);

  if (symbolFileName.includes("node_modules")) {
    symbolFileName = symbolFileName.replace(/.*\/node_modules\//g, "");
  }

  return symbolFileName === fileName || symbolFileName === fileName;
}
