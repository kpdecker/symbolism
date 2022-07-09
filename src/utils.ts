import ts from 'typescript';

export function isArraySymbol(symbol: ts.Symbol): boolean {
  // const arraySymbol = checker
  //   .getSymbolsInScope(node, ts.SymbolFlags.Type)
  //   .find((s) => s.name === 'Array');

  // return type.symbol === arraySymbol;

  return symbol.getName() === 'Array';
}

export function isErrorType(type: ts.Type | undefined): boolean {
  return (type as any)?.intrinsicName === 'error';
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

export function namedPathToNode(
  node: ts.Node,
  checker: ts.TypeChecker,
  filter: (node: ts.Node) => boolean = (node) => !!node,
  child?: ts.Node
): string {
  //
  if (ts.isSourceFile(node)) {
    return '';
  }

  // Stop iterating when we reach a reference
  if (ts.isCallExpression(node) || ts.isBinaryExpression(node)) {
    return '';
  }

  if (
    ts.isBlock(node) ||
    ts.isModuleBlock(node) ||
    ts.isReturnStatement(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isVariableDeclarationList(node) ||
    ts.isExpressionStatement(node) ||
    ts.isBinaryExpression(node) ||
    ts.isNewExpression(node) ||
    ts.isJsxSelfClosingElement(node) ||
    ts.isObjectBindingPattern(node) ||
    ts.isTryStatement(node) ||
    ts.isCatchClause(node) ||
    ts.isAwaitExpression(node) ||
    ts.isObjectLiteralExpression(node) ||
    ts.isTaggedTemplateExpression(node) ||
    ts.isTemplateExpression(node) ||
    ts.isClassExpression(node) ||
    ts.isTemplateSpan(node) ||
    //
    // Types
    ts.isFunctionTypeNode(node) ||
    ts.isParenthesizedTypeNode(node) ||
    ts.isTypeLiteralNode(node) ||
    //
    node.kind === ts.SyntaxKind.FirstStatement
  ) {
    return namedPathToNode(node.parent, checker, filter, node);
  }

  let parentPath = '';
  if (filter(node.parent)) {
    parentPath = namedPathToNode(node.parent, checker, filter, node) + '.';
  }

  // Avoid duplicate identifiers
  if (ts.isIdentifier(node)) {
    if ((node.parent as any).name?.getText() === node.getText()) {
      return namedPathToNode(node.parent, checker, filter, node);
    }
  }

  let name = '';
  const symbol = checker.getSymbolAtLocation(node);
  if (symbol) {
    name = symbol.name;
  } else if (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isModuleDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isEnumMember(node) ||
    ts.isClassDeclaration(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isMethodDeclaration(node)
  ) {
    name = node.name?.getText() || name;
  } else if (
    ts.isVariableDeclaration(node) ||
    ts.isPropertySignature(node) ||
    ts.isJsxAttribute(node) ||
    ts.isTypeAliasDeclaration(node)
  ) {
    if (ts.isIdentifier(node.name)) {
      name = node.name.text;
    } else {
      // TODO: Finish
      name = node.name.getText();
    }
  } else if (ts.isPropertyAssignment(node)) {
    name = node.name.getText();
  } else if (ts.isParameter(node)) {
    name = node.name.getText();
  } else if (ts.isArrayLiteralExpression(node) || ts.isArrayTypeNode(node)) {
    name = '[]';
  } else if (ts.isIfStatement(node)) {
    name = 'if';
  } else if (ts.isJsxElement(node)) {
    name = '<' + node.openingElement.tagName.getText() + '>';
  } else if (ts.isTypeParameterDeclaration(node)) {
    name = '<' + node.name.getText() + '>';
  } else {
    // TODO: Better naming here
    name = ts.SyntaxKind[node.kind] + '(' + name + ')';
  }
  // name = ts.SyntaxKind[node.kind] + '(' + name + ')';

  return parentPath + name;
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
