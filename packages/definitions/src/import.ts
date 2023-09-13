import {
  getSymbolDeclaration,
  invariantNode,
  resolveExternalModuleName,
} from "@noom-symbolism/ts-utils";
import { logWarn } from "@noom-symbolism/utils";
import invariant from "tiny-invariant";
import ts, { findAncestor } from "typescript";
import { defineSymbol } from ".";
import { deferred, directTypeAndSymbol, nodeOperators } from "./utils";

export const importOperators = nodeOperators({
  [ts.SyntaxKind.ImportType]: directTypeAndSymbol,
  [ts.SyntaxKind.NamespaceExportDeclaration]: directTypeAndSymbol,
  [ts.SyntaxKind.ImportEqualsDeclaration]: directTypeAndSymbol,
  [ts.SyntaxKind.ImportDeclaration](node, checker) {
    invariantNode(node, checker, ts.isImportDeclaration);
    const { moduleSpecifier } = node;

    const moduleSymbol = resolveExternalModuleName(checker, moduleSpecifier);
    if (!moduleSymbol) {
      return directTypeAndSymbol(node, checker);
    }

    const moduleDeclaration = getSymbolDeclaration(moduleSymbol);
    invariant(moduleDeclaration);

    return {
      symbol: moduleSymbol,
      declaration: moduleDeclaration,
      getType: deferred(() =>
        checker.getTypeOfSymbolAtLocation(moduleSymbol, moduleDeclaration)
      ),
    };
  },
  [ts.SyntaxKind.ImportClause](node, checker) {
    invariantNode(node, checker, ts.isImportClause);
    return defineSymbol(node.parent, checker);
  },
  [ts.SyntaxKind.NamespaceImport]: directTypeAndSymbol,
  [ts.SyntaxKind.NamedImports]: directTypeAndSymbol,
  [ts.SyntaxKind.ImportSpecifier](node, checker) {
    invariantNode(node, checker, ts.isImportSpecifier);

    const importDeclaration = findAncestor(node, ts.isImportDeclaration);
    invariant(importDeclaration);

    const externalModule = resolveExternalModuleName(
      checker,
      importDeclaration.moduleSpecifier
    );
    if (!externalModule) {
      logWarn(
        "Failed to resolve externalModule",
        importDeclaration.moduleSpecifier
      );
      return null;
    }

    const name = (node.propertyName || node.name).getText();
    const member = checker.tryGetMemberInModuleExports(name, externalModule);
    const memberDeclaration = getSymbolDeclaration(member);
    if (memberDeclaration) {
      return {
        symbol: member,
        declaration: memberDeclaration,
        getType: deferred(() => checker.getTypeAtLocation(memberDeclaration)),
      };
    } else {
      logWarn(`Could not find member ${name} in ${externalModule.name}`);
    }

    return directTypeAndSymbol(node, checker);
  },
  [ts.SyntaxKind.ExportAssignment]: directTypeAndSymbol,
  [ts.SyntaxKind.ExportDeclaration]: directTypeAndSymbol,
  [ts.SyntaxKind.NamedExports]: directTypeAndSymbol,
  [ts.SyntaxKind.NamespaceExport]: directTypeAndSymbol,
  [ts.SyntaxKind.ExportSpecifier]: directTypeAndSymbol,
  [ts.SyntaxKind.ExternalModuleReference]: directTypeAndSymbol,
  [ts.SyntaxKind.ImportTypeAssertionContainer]: directTypeAndSymbol,
  [ts.SyntaxKind.AssertClause]: directTypeAndSymbol,
  [ts.SyntaxKind.AssertEntry]: directTypeAndSymbol,
  [ts.SyntaxKind.MetaProperty]: directTypeAndSymbol, // import.foo
});
