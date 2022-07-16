import ts from "typescript";

export function isArraySymbol(symbol: ts.Symbol): boolean {
  // const arraySymbol = checker
  //   .getSymbolsInScope(node, ts.SymbolFlags.Type)
  //   .find((s) => s.name === 'Array');

  // return type.symbol === arraySymbol;

  return symbol.getName() === "Array";
}

export function isErrorType(type: ts.Type | undefined): boolean {
  return (type as any)?.intrinsicName === "error";
}

const intrinsicTypes =
  ts.TypeFlags.Any |
  ts.TypeFlags.Unknown |
  ts.TypeFlags.String |
  ts.TypeFlags.Number |
  ts.TypeFlags.BigInt |
  ts.TypeFlags.Boolean |
  ts.TypeFlags.BooleanLiteral |
  ts.TypeFlags.ESSymbol |
  ts.TypeFlags.Void |
  ts.TypeFlags.Undefined |
  ts.TypeFlags.Null |
  ts.TypeFlags.Never |
  ts.TypeFlags.NonPrimitive;

export function isIntrinsicType(type: ts.Type) {
  return (type.flags & intrinsicTypes) !== 0;
}
export function isTypeReference(type: ts.Type): type is ts.TypeReference {
  return !!(
    type.flags & ts.TypeFlags.Object &&
    (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference
  );
}

export function getSymbolDeclaration(
  symbol: ts.Symbol | undefined
): ts.Declaration | undefined {
  return symbol?.valueDeclaration || symbol?.declarations?.[0];
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
  return { symbol, type: propertyType };
}

// Via https://github.com/microsoft/TypeScript/blob/5d65c4dc26334ec7518d2472a9b3b69dac9ff2b5/src/compiler/program.ts#L2667
/** Returns a token if position is in [start-of-leading-trivia, end), includes JSDoc only in JS files */
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
  while (true) {
    const child = ts.forEachChild(current, getContainingChild);
    if (!child) {
      return current;
    }
    current = child;
  }
}

// Via https://github.com/TypeStrong/typedoc/blob/9d84e2ef5f3321cb743f9befd3a92084b67dd244/src/lib/converter/converter.ts#L431
export function getSymbolForModuleLike(
  program: ts.Program,
  node: ts.SourceFile | ts.ModuleBlock
) {
  const checker = program.getTypeChecker();
  const symbol: ts.Symbol =
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

function isTransientSymbol(symbol: ts.Symbol) {
  return (symbol.flags & ts.SymbolFlags.Transient) !== 0;
}

function isAliasSymbol(symbol: ts.Symbol): boolean {
  return (symbol.flags & ts.SymbolFlags.Alias) !== 0;
}
function skipAlias(symbol: ts.Symbol, checker: ts.TypeChecker) {
  return symbol.flags & ts.SymbolFlags.Alias
    ? checker.getAliasedSymbol(symbol)
    : symbol;
}
