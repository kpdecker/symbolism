import ts, { findAncestor } from "typescript";
import invariant from "tiny-invariant";

import { Config } from "./config";
import { getSymbolDeclaration, isIntrinsicType } from "./utils";
import { lineAndColumn } from "./coverage";
import { defineSymbol } from "./definition-symbol/index";
import { namedPathToNode } from "./path/index";
import { logInfo, LogLevel, logVerbose, logWarn, setLogLevel } from "./logger";
import { dumpFlags } from "../test/utils";

type SymbolTable = Map<ts.Symbol, Set<ts.Node>>;

export function parseSymbolTable(program: ts.Program, config: Config) {
  const sourceFiles = program
    .getSourceFiles()
    .filter(({ fileName }) => !config.exclude(fileName));

  const symbols: SymbolTable = new Map();

  const checker = program.getTypeChecker();
  sourceFiles.forEach((sourceFile) => {
    if (config.exclude(sourceFile.fileName)) {
      return;
    }

    logInfo(`Parsing symbols in ${sourceFile.fileName}`);

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

        // Filter out known tokens that do not have explicit symbols
        if (node.getText() === "undefined" || node.getText() === "arguments") {
          return;
        }

        const symbol = checker.getSymbolAtLocation(node);
        if (!symbol) {
          logVerbose("No Symbol:", dumpNode(node, checker));
          return;
        }

        const type = checker.getTypeAtLocation(node);
        if (isIntrinsicType(type)) {
          logVerbose("Intensic Symbol:", dumpNode(node, checker));
          return;
        }

        const symbolDeclaration = getSymbolDeclaration(symbol);

        /**
         * The symbol that will serve as our primary key for reference tracking.
         */
        let definitionSymbol: ts.Symbol | null | undefined;

        // If the type checker resolved a direct type, use that
        definitionSymbol = type?.getSymbol();

        if (definitionSymbol === undefined) {
          const inferredType = defineSymbol(node, checker);
          definitionSymbol = inferredType?.symbol;
        }

        // If this is a function parameter then we are at our identity
        if (definitionSymbol === undefined && symbolDeclaration) {
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
        if (definitionSymbol === undefined && symbolDeclaration) {
          if (
            ts.isVariableDeclaration(symbolDeclaration) ||
            ts.isPropertySignature(symbolDeclaration) ||
            ts.isPropertyAssignment(symbolDeclaration)
          ) {
            definitionSymbol = symbol;
          }
        }

        if (!definitionSymbol) {
          return;
        }

        // Don't omit the declaration case
        const definitionNode = getSymbolDeclaration(definitionSymbol);
        if (!definitionNode) {
          if (!(definitionSymbol.flags & ts.SymbolFlags.Transient)) {
            logWarn(
              "Definition symbol lacking declaration",
              dumpNode(node, checker),
              dumpSymbol(definitionSymbol, checker)
            );
          }

          return;
        }
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

/**
 * Helper method to dump a symbol table into summary data. This is intended
 * for debugging purposes.
 */
export function extractSymbolSummary(
  symbols: SymbolTable,
  checker: ts.TypeChecker
) {
  const pathMap: Map<string, ts.Symbol> = new Map();
  const declarationPaths: string[] = [];
  const allPaths: string[] = [];

  symbols.forEach((symbolMap, symbol) => {
    const declarationPath = namedPathToNode(
      getSymbolDeclaration(symbol)!,
      checker
    );
    if (declarationPath) {
      declarationPaths.push(declarationPath);
      pathMap.set(declarationPath, symbol);
    }
    symbolMap.forEach((referenceNode) => {
      const referencePath = namedPathToNode(referenceNode, checker);
      if (!allPaths.includes(referencePath)) {
        allPaths.push(referencePath);
      }
    });
  });

  declarationPaths.sort();
  allPaths.sort();
  return allPaths.map((path) => {
    const symbol = pathMap.get(path);
    const references = symbols.get(symbol!);
    return {
      path,
      size: references?.size || 0,
    };
  });
}

export function dumpSymbolTable(symbols: SymbolTable, checker: ts.TypeChecker) {
  const ret: Map<
    ReturnType<typeof dumpSymbol>["declaration"][0],
    ReturnType<typeof dumpSymbol>["declaration"]
  > = new Map();

  symbols.forEach((symbolMap, symbol) => {
    const source = dumpSymbol(symbol, checker)?.declaration[0];

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
  const declarations = symbol?.declarations || [];
  const declarationDump: ReturnType<typeof dumpNode>[] = declarations.map(
    (node) => dumpNode(node, checker)
  );

  if (symbol && !declarations.length) {
    if (symbol.flags & ts.SymbolFlags.Transient) {
      declarationDump.push({
        kind: "transient",
        name: symbol.getName(),
        fileName: "transient",
        path: symbol.getName(),
        line: 1,
        column: 1,
      });
    } else if (isIntrinsicType(checker.getDeclaredTypeOfSymbol(symbol))) {
      declarationDump.push({
        kind: "keyword",
        name: symbol.getName(),
        fileName: "intrinsic",
        path: symbol.getName(),
        line: 1,
        column: 1,
      });
    }
  }

  invariant(
    !symbol || declarationDump.length,
    "Missing declaration: " + symbol?.getName()
  );

  return {
    id: (symbol as any)?.id,
    flags: dumpFlags(symbol?.getFlags(), ts.SymbolFlags),
    declaration: declarationDump,
  };
}

export function dumpNode(
  node: ts.Node,
  checker: ts.TypeChecker,
  omitPath = false
) {
  const sourceFile = node.getSourceFile();
  const fileName = sourceFile.fileName;
  const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart());

  const ret = {
    kind: ts.SyntaxKind[node.kind],
    name: "",
    path: !omitPath ? namedPathToNode(node, checker) : "",
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
        " " +
        (checker.getSymbolAtLocation(node.parent.parent.parent) &&
          checker.getFullyQualifiedName(
            checker.getSymbolAtLocation(node.parent.parent.parent)!
          ));
    }
  }
  ret.name = name;

  return ret;
}
