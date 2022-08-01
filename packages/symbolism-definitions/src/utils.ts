import ts from "typescript";
import { logDebug } from "@symbolism/utils";
import {
  getSymbolDeclaration,
  invariantNode,
  isArraySymbol,
  isErrorType,
  isExpression,
  isInheritingDeclaration,
} from "@symbolism/ts-utils";

export type DefinitionSymbol = {
  symbol: ts.Symbol | undefined;
  declaration: ts.Declaration | undefined;
  type: ts.Type | undefined;
};
export type DefinitionOperation = (
  node: ts.Node,
  checker: ts.TypeChecker
) => DefinitionSymbol | undefined | null;

export function nodeOperators<
  T extends { [kind: number]: DefinitionOperation }
>(cfg: T) {
  return cfg;
}

// Infers definition from where the symbol is defined vs. explicit types.
// I.e. for jsx attributes, it resolves the props for the parent element.
export function contextualTypeAndSymbol(
  node: ts.Node,
  checker: ts.TypeChecker
): DefinitionSymbol {
  invariantNode(node, isExpression);
  const contextType = checker.getContextualType(node);
  if (contextType) {
    return getArrayType({
      symbol: contextType.symbol,
      declaration: getSymbolDeclaration(contextType.symbol),
      type: contextType,
    });
  }
  return directTypeAndSymbol(node, checker);
}

export function directTypeAndSymbol(
  node: ts.Node,
  checker: ts.TypeChecker
): DefinitionSymbol {
  const symbol = checker.getSymbolAtLocation(node);
  let type: ts.Type;

  if (symbol && !ts.isGetAccessor(node)) {
    type = checker.getTypeOfSymbolAtLocation(symbol, node);
  } else {
    type = checker.getTypeAtLocation(node);
  }

  if (isErrorType(type)) {
    // If we errored while attempting to resolve the type from the node
    // (have seen this happen with symbols pointing to InterfaceDeclarations),
    // we can try to resolve the type from the symbol.
    type = checker.getTypeAtLocation(node);
  }

  return {
    symbol: symbol || type.symbol,
    declaration: getSymbolDeclaration(symbol || type.symbol),
    type,
  };
}

export function getPropertySymbol(
  node: ts.Node,
  type: ts.Type,
  checker: ts.TypeChecker,
  name: string,
  {
    stringIndex,
    numberIndex,
  }: { stringIndex?: boolean; numberIndex?: boolean } = {}
) {
  const symbol =
    type.getProperty(name) ||
    (stringIndex && type.getStringIndexType()?.symbol) ||
    (numberIndex && type.getNumberIndexType()?.symbol) ||
    undefined;

  if (!symbol) {
    logDebug(`No symbol found for ${name} on ${checker.typeToString(type)}`);
    return undefined;
  }

  let propertyType: ts.Type | undefined = undefined;
  if (symbol) {
    const declaration = symbol.declarations?.[0];
    if (ts.isBindingElement(node) && declaration) {
      propertyType = checker.getTypeAtLocation(declaration);
    } else {
      propertyType = checker.getTypeOfSymbolAtLocation(symbol, node);
    }
  }

  // Two distinct objects here lets us track both the property in code and
  // the ultimate type that it resolves to.
  return {
    symbol,
    declaration: getSymbolDeclaration(symbol),
    type: propertyType,
  };
}

export function getArrayType(inferred: DefinitionSymbol) {
  const { type, symbol } = inferred;

  // If our parent is an array, we need to get the element type
  const numberIndexType = type?.getNumberIndexType();
  if (symbol && isArraySymbol(symbol) && numberIndexType) {
    return {
      symbol: numberIndexType?.symbol || symbol,
      declaration: getSymbolDeclaration(numberIndexType?.symbol || symbol),
      type: numberIndexType,
    };
  }

  return inferred;
}

export function collectAllAncestorTypes(
  node: ts.Node,
  checker: ts.TypeChecker
): ts.Type[] {
  // { foo() {} }
  if (ts.isObjectLiteralExpression(node)) {
    return [];
  }

  invariantNode(node, isInheritingDeclaration);
  if (!node.heritageClauses) {
    return [];
  }

  return node.heritageClauses
    .flatMap((clause) => clause.types)
    .map((typeNode) => checker.getTypeAtLocation(typeNode))
    .flatMap((type) => {
      if (type.symbol) {
        const declaration = type.symbol.declarations?.[0];
        if (declaration && isInheritingDeclaration(declaration)) {
          return [...collectAllAncestorTypes(declaration, checker), type];
        }
      }
      return [type];
    });
}
