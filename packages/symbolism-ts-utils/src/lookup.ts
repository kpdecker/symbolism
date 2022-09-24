import ts, { LineAndCharacter } from "typescript";
import { isAliasSymbol, isTransientSymbol } from "./classify";

export type LineAndColumn = { line: number; column: number };

export function lineAndColumn(lineAndChar: LineAndCharacter) {
  // Return 1 index for both
  return { line: lineAndChar.line + 1, column: lineAndChar.character + 1 };
}

export function getSymbolDeclaration(
  symbol: ts.Symbol | null | undefined
): ts.Declaration | undefined {
  return symbol?.valueDeclaration || symbol?.declarations?.[0];
}

// Via https://github.com/microsoft/TypeScript/blob/5d65c4dc26334ec7518d2472a9b3b69dac9ff2b5/src/compiler/program.ts#L2667
/** Returns a token if position is in [start-of-leading-trivia, end), includes JSDoc only in JS files */
/* istanbul ignore next */
export function getNodeAtPosition(
  sourceFile: ts.SourceFile,
  position: number
): ts.Node {
  let current: ts.Node = sourceFile;
  const getContainingChild = (child: ts.Node) => {
    if (
      child.pos <= position &&
      (position < child.end ||
        (position === child.end && child.kind === ts.SyntaxKind.EndOfFileToken))
    ) {
      return child;
    }
  };
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const child = ts.forEachChild(current, getContainingChild);
    if (!child) {
      return current;
    }
    current = child;
  }
}

// Via https://github.com/TypeStrong/typedoc/blob/9d84e2ef5f3321cb743f9befd3a92084b67dd244/src/lib/converter/converter.ts#L431
/* istanbul ignore next */
export function getSymbolForModuleLike(
  program: ts.Program,
  node: ts.SourceFile | ts.ModuleBlock
) {
  const checker = program.getTypeChecker();
  const symbol: ts.Symbol =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    checker.getSymbolAtLocation(node) ?? (node as any).symbol;

  if (symbol) {
    return symbol;
  }

  // This is a global file, get all symbols declared in this file...
  // this isn't the best solution, it would be nice to have all globals given to a special
  // "globals" file, but this is uncommon enough that I'm skipping it for now.
  const sourceFile = node.getSourceFile();
  const globalSymbols = checker
    .getSymbolsInScope(node, ts.SymbolFlags.ModuleMember)
    .filter((s) =>
      s.getDeclarations()?.some((d) => d.getSourceFile() === sourceFile)
    );

  // Detect declaration files with declare module "foo" as their only export
  // and lift that up one level as the source file symbol
  if (
    globalSymbols.length === 1 &&
    globalSymbols[0]
      .getDeclarations()
      ?.every(
        (declaration) =>
          ts.isModuleDeclaration(declaration) &&
          ts.isStringLiteral(declaration.name)
      )
  ) {
    return globalSymbols[0];
  }
}

// Via https://github.com/microsoft/TypeScript/blob/5d65c4dc26334ec7518d2472a9b3b69dac9ff2b5/src/services/utilities.ts#L2479-L2498
/* istanbul ignore next */
export function getSymbolTarget(
  symbol: ts.Symbol,
  checker: ts.TypeChecker
): ts.Symbol {
  let next: ts.Symbol & { target?: ts.Symbol } = symbol;
  while (isAliasSymbol(next) || (isTransientSymbol(next) && next.target)) {
    if (isTransientSymbol(next) && next.target) {
      next = next.target;
    } else {
      next = skipAlias(next, checker);
    }
  }
  return next;
}
function skipAlias(symbol: ts.Symbol, checker: ts.TypeChecker) {
  return symbol.flags & ts.SymbolFlags.Alias
    ? checker.getAliasedSymbol(symbol)
    : symbol;
}

export function findNodeInTree<T extends ts.Node>(
  node: ts.Node,
  matcher: (node: ts.Node) => node is T
): T | undefined {
  if (matcher(node)) {
    return node;
  }

  for (const child of node.getChildren()) {
    const result = findNodeInTree(child, matcher);
    if (result) {
      return result;
    }
  }

  return undefined;
}

export function findNodesInTree<T extends ts.Node>(
  node: ts.Node,
  matcher: (node: ts.Node) => node is T
): T[] {
  if (matcher(node)) {
    return [node];
  }

  const ret = [];
  for (const child of node.getChildren()) {
    ret.push(...findNodesInTree(child, matcher));
  }

  return ret;
}

export function findIdentifiers(node: ts.Node, name: string) {
  return findNodesInTree(node, (node): node is ts.Identifier => {
    return ts.isIdentifier(node) && node.text === name;
  });
}
