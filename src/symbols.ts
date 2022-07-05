import ts from 'typescript';
import invariant from 'tiny-invariant';

import { lineAndColumn, LineAndColumn } from './coverage';

type SymbolTable = Record<string, Set<ts.Symbol>>;

export function dumpSymbolTable(symbols: SymbolTable) {
  const ret: Record<
    string,
    ({ kind: string; fileName: string } & LineAndColumn)[]
  > = Object.create(null);

  Object.keys(symbols).forEach((name) => {
    symbols[name].forEach((symbol) => {
      ret[name] ??= [];
      ret[name].push(...dumpSymbol(symbol));
    });
  });
  return ret;
}

export function dumpSymbol(symbol: ts.Symbol) {
  const declarations = symbol.declarations || [];
  invariant(declarations.length, 'Missing declaration: ' + symbol.getName());

  return declarations.map((declaration) => {
    const sourceFile = declaration.getSourceFile();
    const fileName = sourceFile.fileName;
    const lineAndChar = sourceFile.getLineAndCharacterOfPosition(
      declaration.getStart()
    );

    return {
      kind: ts.SyntaxKind[declaration.kind],
      fileName,
      ...lineAndColumn(lineAndChar),
    };
  });
}
