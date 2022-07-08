import ts from 'typescript';
import { isArraySymbol } from '../utils';

export type DefinitionSymbol = {
  symbol: ts.Symbol | undefined;
  type: ts.Type | undefined;
};

export function directTypeAndSymbol(
  node: ts.Node,
  checker: ts.TypeChecker
): DefinitionSymbol {
  const symbol = checker.getSymbolAtLocation(node);
  let type: ts.Type;

  if (symbol) {
    type = checker.getTypeOfSymbolAtLocation(symbol, node);
  } else {
    type = checker.getTypeAtLocation(node);
  }

  return {
    symbol: symbol ? symbol : type.symbol,
    type,
  };
}

export function getArrayType(inferred: DefinitionSymbol) {
  const { type, symbol } = inferred;

  // If our parent is an array, we need to get the element type
  if (type && symbol && isArraySymbol(symbol) && type.getNumberIndexType()) {
    const numberIndexType = type.getNumberIndexType();
    return {
      symbol: numberIndexType?.symbol || symbol,
      type: type.getNumberIndexType(),
    };
  }
}
