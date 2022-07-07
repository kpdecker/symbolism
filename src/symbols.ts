import ts, { findAncestor } from 'typescript';
import invariant from 'tiny-invariant';
import { getTokenAtPosition } from 'tsutils';

import { Config } from './config';
import { isIntrinsicType, namedPathToNode } from './utils';
import { lineAndColumn } from './coverage';
import { getSymbolFromLanguageServices } from './definition-symbol/language-services';
import { getSymbolForJSXAttribute } from './definition-symbol/jsx';
import { defineType } from './definition-symbol/index';

type SymbolTable = Map<ts.Symbol, Set<ts.Node>>;

export function parseSymbolTable(
  program: ts.Program,
  services: ts.LanguageService,
  config: Config
) {
  const sourceFiles = program
    .getSourceFiles()
    .filter(({ fileName }) => !config.exclude(fileName));

  const symbols: SymbolTable = new Map();

  const checker = program.getTypeChecker();
  sourceFiles.forEach((sourceFile) => {
    if (config.exclude(sourceFile.fileName)) {
      return;
    }

    ts.forEachChild(sourceFile, function visitNode(node) {
      // Filter nodes that we already know everything about
      if (ts.isJsxClosingElement(node)) {
        return;
      }

      // Filter type references, the checker will handle any lookups for there
      if (
        ts.isTypeAliasDeclaration(node) ||
        ts.isTypeReferenceNode(node) ||
        ts.isTypeQueryNode(node) ||
        ts.isTypeLiteralNode(node)
      ) {
        return;
      }

      // Filter import/export declarations
      if (
        ts.isImportDeclaration(node) ||
        ts.isExportDeclaration(node) ||
        ts.isExportAssignment(node.parent)
      ) {
        return;
      }

      if (ts.isIdentifier(node)) {
        // Declarations NOP as the symbol mapping takes care of this
        if (
          ts.isFunctionDeclaration(node.parent) ||
          ts.isVariableDeclaration(node.parent) ||
          ts.isParameter(node.parent) ||
          ts.isPropertyDeclaration(node.parent) ||
          ts.isImportSpecifier(node.parent) ||
          ts.isPropertySignature(node.parent)
        ) {
          return;
        }

        const symbol = checker.getSymbolAtLocation(node);
        if (!symbol) {
          // TODO: Put behind verbose logging
          // console.error('No Symbol:', dumpNode(node, checker));
          return;
        }

        if (isIntrinsicType(checker.getDeclaredTypeOfSymbol(symbol))) {
          // No source declarations for intrinsic types
          return;
        }

        const symbolDeclaration =
          symbol.valueDeclaration || symbol.declarations?.[0];
        invariant(symbolDeclaration, 'No declaration for symbol');

        const type = checker.getTypeAtLocation(node);

        /**
         * The symbol that will serve as our primary key for reference tracking.
         */
        let definitionSymbol: ts.Symbol | null | undefined;

        // If the type checker resolved a direct type, use that
        definitionSymbol = type?.getSymbol();

        // Use language services definition lookup when it works
        if (definitionSymbol === undefined) {
          definitionSymbol = getSymbolFromLanguageServices(node, services);
        }

        if (definitionSymbol === undefined) {
          const inferredType = defineType(node, checker);
          definitionSymbol = inferredType?.symbol;
        }

        // JSX Attributes
        if (definitionSymbol === undefined) {
          if (ts.isJsxAttribute(symbolDeclaration)) {
            definitionSymbol = getSymbolForJSXAttribute(
              symbolDeclaration,
              checker
            );
          }
        }

        // If this is a function parameter then we are at our identity
        if (definitionSymbol === undefined) {
          if (ts.isParameter(symbolDeclaration)) {
            const parameter = symbolDeclaration;
            if (
              ts.isFunctionDeclaration(parameter.parent) ||
              ts.isArrowFunction(parameter.parent)
            ) {
              definitionSymbol = symbol;
            }
          }
        }

        // Variable declarations are also identity
        if (definitionSymbol === undefined) {
          if (
            ts.isVariableDeclaration(symbolDeclaration) ||
            ts.isPropertySignature(symbolDeclaration) ||
            ts.isPropertyAssignment(symbolDeclaration)
          ) {
            definitionSymbol = symbol;
          }
        }

        // Explicitly missing
        if (definitionSymbol === null) {
          return;
        }
        invariant(definitionSymbol);

        // Don't omit the declaration case
        const definitionNode = definitionSymbol.declarations?.[0];
        invariant(definitionNode);
        if (
          definitionNode.getSourceFile() === sourceFile &&
          definitionNode.pos === node.pos
        ) {
          return;
        }

        const symbolMap = symbols.get(definitionSymbol) || new Set();
        symbols.set(definitionSymbol, symbolMap);
        symbolMap.add(node);
      }
      ts.forEachChild(node, visitNode);
    });
  });

  return symbols;
}

export function dumpSymbolTable(symbols: SymbolTable, checker: ts.TypeChecker) {
  const ret: Map<
    ReturnType<typeof dumpSymbol>[0],
    ReturnType<typeof dumpSymbol>
  > = new Map();

  symbols.forEach((symbolMap, symbol) => {
    const source = dumpSymbol(symbol, checker)![0];

    // Filter for debugging
    if (
      source.kind === 'EnumDeclaration' ||
      source.kind === 'ClassDeclaration'
    ) {
      return;
    }

    symbolMap.forEach((node) => {
      ret.set(source, ret.get(source) || []);
      ret.get(source)!.push(dumpNode(node, checker));
    });
  });
  return ret;
}

export function dumpSymbol(
  symbol: ts.Symbol | undefined,
  checker: ts.TypeChecker
) {
  if (!symbol) {
    return [];
  }

  const declarations = symbol.declarations || [];

  if (
    !declarations.length &&
    isIntrinsicType(checker.getDeclaredTypeOfSymbol(symbol))
  ) {
    return [{ kind: 'keyword', name: symbol.getName() }];
  }

  invariant(declarations.length, 'Missing declaration: ' + symbol.getName());

  return declarations.map((node) => dumpNode(node, checker));
}

export function dumpNode(node: ts.Node, checker: ts.TypeChecker) {
  const sourceFile = node.getSourceFile();
  const fileName = sourceFile.fileName;
  const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart());

  const ret = {
    kind: ts.SyntaxKind[node.kind],
    name: '',
    path: namedPathToNode(node, checker),
    fileName,
    ...lineAndColumn(lineAndChar),
  };

  let name = node.getText().split(/\n/g)[0];
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    if (ts.isVariableDeclaration(node.parent)) {
      // TODO: Perform this mapping in the symbol table
      name = node.parent.name.getText();
    }
  } else if (ts.isFunctionDeclaration(node)) {
    name = node.name?.getText() || name;
  } else if (ts.isPropertyAssignment(node)) {
    const declaration = findAncestor(node, (node) =>
      ts.isVariableDeclaration(node)
    ) as ts.VariableDeclaration;
    if (declaration) {
      const variableType = checker.getTypeAtLocation(declaration);
      // console.log(variableType.getProperties());

      name =
        declaration.name.getText() +
        ' ' +
        (checker.getSymbolAtLocation(node.parent.parent.parent) &&
          checker.getFullyQualifiedName(
            checker.getSymbolAtLocation(node.parent.parent.parent)!
          ));
    }
  }
  ret.name = name;

  return ret;
}
