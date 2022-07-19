import ts from "typescript";
import { getSymbolDeclaration, getSymbolTarget } from "../utils";
import invariant from "tiny-invariant";
import { DefinitionSymbol } from "./utils";
import { defineSymbol } from "./index";

export function followSymbol(
  definition: DefinitionSymbol | undefined | null,
  checker: ts.TypeChecker
) {
  const { symbol } = definition || {};
  if (!symbol || !definition) {
    return definition;
  }

  const symbolTarget = getSymbolTarget(symbol, checker);
  if (symbolTarget !== symbol) {
    const targetDeclaration = getSymbolDeclaration(symbol);
    invariant(
      targetDeclaration,
      "Expected to find a declaration for the symbol"
    );
    return {
      symbol: symbolTarget,
      type: definition.type,
    };
  }

  const typeDeclaration = getSymbolDeclaration(symbol);
  if (typeDeclaration) {
    const followedDefinition = defineSymbol(typeDeclaration, checker);

    if (
      // Check that we have a fully resolved definition
      followedDefinition?.symbol &&
      followedDefinition.type
    ) {
      return {
        symbol: followedDefinition.symbol,
        type: definition.type,
      };
    }
  }

  return definition;
}
