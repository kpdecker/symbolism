import {
  getSymbolDeclaration,
  invariantNode,
  isNamedDeclaration,
} from "@symbolism/ts-utils";
import ts, { findAncestor } from "typescript";
import { defineSymbol } from "./index";
import { directTypeAndSymbol, nodeOperators } from "./utils";

export const functionOperators = nodeOperators({
  [ts.SyntaxKind.CallExpression]: defineCallReturn,
  [ts.SyntaxKind.NewExpression]: defineCallReturn,

  [ts.SyntaxKind.FunctionExpression](node, checker, options) {
    invariantNode(node, checker, ts.isFunctionExpression);
    if (node.name) {
      return directTypeAndSymbol(node.name, checker);
    }
    return defineSymbol(node.parent, checker, options);
  },
  [ts.SyntaxKind.FunctionDeclaration]: directTypeAndSymbol,
  [ts.SyntaxKind.ArrowFunction](node, checker) {
    invariantNode(node, checker, ts.isArrowFunction);

    if (isNamedDeclaration(node.parent) && node.parent.name) {
      return directTypeAndSymbol(node.parent.name, checker);
    }

    return directTypeAndSymbol(node, checker);
  },
  [ts.SyntaxKind.Parameter](node, checker) {
    invariantNode(node, checker, ts.isParameter);

    const parameterDefinition = directTypeAndSymbol(node, checker);

    // If we don't have a type, then resolve as our own definition
    // ex: constructor(public readonly name: string)
    if (!getSymbolDeclaration(parameterDefinition.symbol)) {
      return directTypeAndSymbol(node.name, checker);
    }

    return parameterDefinition;
  },

  [ts.SyntaxKind.Block]: () => undefined,
  [ts.SyntaxKind.YieldExpression]: directTypeAndSymbol,
  [ts.SyntaxKind.ReturnStatement]: handleReturnStatement,
});

function defineCallReturn(node: ts.Node, checker: ts.TypeChecker) {
  if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
    const signature = checker.getResolvedSignature(node);
    if (signature) {
      const returnType = signature.getReturnType();
      if (returnType) {
        return {
          symbol: returnType.symbol,
          declaration: getSymbolDeclaration(returnType.symbol),
          getType: () => returnType,
        };
      }
    }
  }
}

function handleReturnStatement(node: ts.Node, checker: ts.TypeChecker) {
  if (ts.isReturnStatement(node)) {
    const parent = findAncestor(node, ts.isFunctionLike);
    if (parent?.type) {
      return directTypeAndSymbol(parent.type, checker);
    }

    if (node.expression) {
      return directTypeAndSymbol(node.expression, checker);
    }

    return null;
  }
}
