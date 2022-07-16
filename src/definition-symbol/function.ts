import ts, { findAncestor } from "typescript";
import { defineSymbol } from "./index";
import { directTypeAndSymbol, invariantNode, nodeOperators } from "./utils";

export const functionOperators = nodeOperators({
  [ts.SyntaxKind.CallExpression]: defineCallReturn,
  [ts.SyntaxKind.NewExpression]: defineCallReturn,
  [ts.SyntaxKind.ArrowFunction]: defineCallReturn,

  [ts.SyntaxKind.FunctionExpression](node, checker) {
    return defineSymbol(node.parent, checker);
  },
  [ts.SyntaxKind.FunctionDeclaration]: directTypeAndSymbol,
  [ts.SyntaxKind.Parameter](node, checker) {
    invariantNode(node, ts.isParameter);

    if (ts.isParameterPropertyDeclaration(node, node.parent)) {
      return directTypeAndSymbol(node.name, checker);
    }
    return directTypeAndSymbol(node, checker);
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
          type: returnType,
          symbol: returnType.symbol,
        };
      }
    }
  }
  if (ts.isArrowFunction(node)) {
    return directTypeAndSymbol(node, checker);
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
