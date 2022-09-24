import ts from "typescript";
import invariant from "tiny-invariant";

import {
  bitwiseFlagSet,
  Config,
  logDebug,
  logVerbose,
  logWarn,
  NodeError,
} from "@symbolism/utils";
import { defineSymbol } from "@symbolism/definitions";
import { getNodePath, pathMatchesTokenFilter } from "@symbolism/paths";
import { getSymbolDeclaration, isIntrinsicType } from "@symbolism/ts-utils";
import { dumpNode, dumpSymbol } from "@symbolism/ts-debug";
import { relative } from "path";

export * from "./symbol-filters";

export class SymbolTable extends Map<ts.Symbol, Set<ts.Node>> {
  lookup(pathFilter: string, checker: ts.TypeChecker) {
    return Array.from(this.keys()).filter((key) => {
      if (
        pathMatchesTokenFilter(
          getNodePath(getSymbolDeclaration(key), checker),
          pathFilter
        )
      ) {
        return key;
      }
    });
  }
}

export function parseSymbolTable(program: ts.Program, config: Config) {
  const sourceFiles = program
    .getSourceFiles()
    .filter(({ fileName }) => !config.exclude(fileName));

  const symbols = new SymbolTable();

  const checker = program.getTypeChecker();
  sourceFiles
    .sort((a, b) => a.fileName.localeCompare(b.fileName))
    .forEach((sourceFile): void => {
      if (config.exclude(sourceFile.fileName)) {
        return;
      }

      logVerbose(`Parsing symbols in ${relative(".", sourceFile.fileName)}`);

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
          if (
            node.getText() === "undefined" ||
            node.getText() === "arguments"
          ) {
            return;
          }
          /**
           * The symbol that will serve as our primary key for reference tracking.
           */
          let definitionSymbol: ts.Symbol | null | undefined;

          let handlerUsed = "";
          function pickSymbol(handler: string, symbol: ts.Symbol | undefined) {
            if (symbol) {
              definitionSymbol = symbol;
              handlerUsed = handler;
            }
          }

          try {
            const symbol = checker.getSymbolAtLocation(node);
            if (!symbol) {
              logVerbose(
                "No Symbol:",
                () => dumpNode(node, checker),
                () =>
                  dumpSymbol(checker.getSymbolAtLocation(node.parent), checker)
              );
              return;
            }

            const type = checker.getTypeAtLocation(node);
            if (isIntrinsicType(type)) {
              logVerbose(
                "Intrinsic Symbol:",
                () => dumpNode(node, checker),
                () => dumpSymbol(symbol, checker),
                () => checker.typeToString(type)
              );
              pickSymbol("intrinsic", symbol);
            }

            const symbolDeclaration = getSymbolDeclaration(symbol);

            // If the type checker resolved a direct type, use that, if it's
            // not transient.
            const typeSymbol = type?.getSymbol();
            if (!bitwiseFlagSet(typeSymbol?.flags, ts.SymbolFlags.Transient)) {
              pickSymbol("type-symbol", typeSymbol);
            }

            if (!getSymbolDeclaration(definitionSymbol)) {
              const defineType = defineSymbol(node, checker, {
                chooseLocal: false,
              });
              pickSymbol("define-symbol", defineType?.symbol);
            }

            if (!getSymbolDeclaration(definitionSymbol) && symbolDeclaration) {
              // If this is a function parameter then we are at our identity
              if (ts.isParameter(symbolDeclaration)) {
                const parameter = symbolDeclaration;
                if (
                  ts.isFunctionDeclaration(parameter.parent) ||
                  ts.isArrowFunction(parameter.parent)
                ) {
                  pickSymbol("parameter", symbol);
                }

                // Variable declarations are also identity
              } else if (
                ts.isVariableDeclaration(symbolDeclaration) ||
                ts.isPropertySignature(symbolDeclaration) ||
                ts.isPropertyAssignment(symbolDeclaration) ||
                ts.isBindingElement(symbolDeclaration)
              ) {
                pickSymbol("identifier", symbol);
              }
            }

            if (!definitionSymbol) {
              logWarn(
                `No definition symbol found`,
                () => dumpNode(node, checker),
                () => symbolDeclaration && dumpNode(symbolDeclaration, checker),
                definitionSymbol
              );
              return;
            }

            // Don't omit the declaration case
            const definitionNode = getSymbolDeclaration(definitionSymbol);
            if (!definitionNode) {
              if (!(definitionSymbol.flags & ts.SymbolFlags.Transient)) {
                logWarn(
                  "Definition symbol lacking declaration",
                  () => dumpNode(node, checker),
                  () => dumpSymbol(definitionSymbol, checker)
                );
              }

              return;
            }
            invariant(definitionNode);

            // Don't return self declarations
            if (
              definitionNode.getSourceFile() === sourceFile &&
              definitionNode.pos === node.pos
            ) {
              return;
            }

            logDebug(
              "Symbol:",
              handlerUsed,
              () => dumpNode(node, checker),
              () => dumpSymbol(symbol, checker)
            );

            // TODO: Allow for multiple definitions (i.e. root type and variable declaration)?
            const symbolMap = symbols.get(definitionSymbol) || new Set();
            symbols.set(definitionSymbol, symbolMap);
            symbolMap.add(node);
          } catch (e) {
            throw new NodeError(`Failed parsing`, node, checker, e as Error);
          }
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
  const pathMap: Record<string, ts.Symbol[]> = {};
  const declarationPaths: string[] = [];
  const allPaths: string[] = [];

  symbols.forEach((symbolMap, symbol) => {
    const declarationPath = getNodePath(getSymbolDeclaration(symbol), checker);
    if (declarationPath) {
      if (!declarationPaths.includes(declarationPath)) {
        declarationPaths.push(declarationPath);
      }
      pathMap[declarationPath] ??= [];
      pathMap[declarationPath].push(symbol);
    }
    symbolMap.forEach((referenceNode) => {
      const referencePath = getNodePath(referenceNode, checker);
      if (!allPaths.includes(referencePath)) {
        allPaths.push(referencePath);
      }
    });
  });

  declarationPaths.sort();
  allPaths.sort();

  return declarationPaths.map((path) => {
    const pathSymbols = pathMap[path];
    return {
      path,
      size: pathSymbols.reduce(
        (prev, symbol) => prev + (symbols.get(symbol)?.size || 0),
        0
      ),
    };
  });
}

export function dumpSymbolTable(symbols: SymbolTable, checker: ts.TypeChecker) {
  const ret: Map<
    NonNullable<ReturnType<typeof dumpSymbol>>["declaration"][0],
    NonNullable<ReturnType<typeof dumpSymbol>>["declaration"]
  > = new Map();

  symbols.forEach((symbolMap, symbol) => {
    const source = dumpSymbol(symbol, checker)?.declaration[0];
    if (!source) {
      return;
    }

    symbolMap.forEach((node) => {
      ret.set(source, ret.get(source) || []);

      const dumpedNode = dumpNode(node, checker);
      invariant(dumpedNode, "Node is undefined");
      ret.get(source)?.push(dumpedNode);
    });
  });

  return ret;
}
