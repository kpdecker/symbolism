import ts from "typescript";
import { isArraySymbol } from "../utils";

export type DefinitionSymbol = {
  symbol: ts.Symbol | undefined;
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

export function invariantNode<T extends ts.Node>(
  node: ts.Node,
  matcher?: (node: ts.Node) => node is T
): asserts node is T {
  if (!matcher || !matcher(node)) {
    throw new Error(`Unexpected node type: ${ts.SyntaxKind[node.kind]}`);
  }
}

export function isExpression(node: ts.Node): node is ts.Expression {
  return (ts as any).isExpression(node) || ts.isJsxAttributes(node);
}
export function isNamedDeclaration(node: ts.Node): node is ts.NamedDeclaration {
  return isDeclaration(node) && "name" in node;
}
export function isDeclaration(node: ts.Node): node is ts.Declaration {
  return (ts as any).isDeclaration(node);
}
export function isInheritingDeclaration(
  node: ts.Node
): node is ts.ClassLikeDeclaration | ts.InterfaceDeclaration {
  return ts.isClassLike(node) || ts.isInterfaceDeclaration(node);
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

  return {
    symbol: symbol ? symbol : type.symbol,
    type,
  };
}

export function getArrayType(inferred: DefinitionSymbol) {
  const { type, symbol } = inferred;

  // If our parent is an array, we need to get the element type
  const numberIndexType = type?.getNumberIndexType();
  if (symbol && isArraySymbol(symbol) && numberIndexType) {
    return {
      symbol: numberIndexType?.symbol || symbol,
      type: numberIndexType,
    };
  }

  return inferred;
}

export function collectAllAncestorTypes(
  node: ts.Node,
  checker: ts.TypeChecker
): ts.Type[] {
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
