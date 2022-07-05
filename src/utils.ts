import * as ts from 'typescript';

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
