import ts from "typescript";
import invariant from "tiny-invariant";
import { DefinitionOptions, DefinitionSymbol } from "./utils";
import { defineSymbol } from "./index";
import { getSymbolDeclaration, getSymbolTarget } from "@noom-symbolism/ts-utils";

export function followSymbol(
  definition: DefinitionSymbol | undefined | null,
  checker: ts.TypeChecker,
  options: DefinitionOptions
): DefinitionSymbol | undefined | null {
  const { symbol } = definition || {};
  if (!symbol || !definition || options.chooseLocal) {
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
      declaration: targetDeclaration,
      getType: definition.getType,
    };
  }

  const typeDeclaration = getSymbolDeclaration(symbol);
  if (typeDeclaration) {
    const followedDefinition = defineSymbol(typeDeclaration, checker, options);

    if (
      // Check that we have a fully resolved definition
      followedDefinition?.symbol &&
      followedDefinition.getType()
    ) {
      return {
        symbol: followedDefinition.symbol,
        declaration: getSymbolDeclaration(followedDefinition.symbol),
        getType: definition.getType,
      };
    }
  }

  return definition;
}
