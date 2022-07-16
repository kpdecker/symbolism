import ts from "typescript";
import { invariantNode, isNamedDeclaration } from "../definition-symbol/utils";
import {
  nameWithParent,
  pathHandler,
  simpleNameWithParent,
  skipNode,
} from "./handlers";

export const functionOperators = pathHandler({
  [ts.SyntaxKind.CallExpression]: skipNode,
  [ts.SyntaxKind.NewExpression]: skipNode,
  [ts.SyntaxKind.ArrowFunction]({ node, getParentPath }) {
    invariantNode(node, ts.isArrowFunction);
    if (isNamedDeclaration(node.parent)) {
      return getParentPath();
    }
    return getParentPath() + ".=>";
  },

  [ts.SyntaxKind.FunctionExpression]: skipNode,
  [ts.SyntaxKind.FunctionDeclaration]: nameWithParent,
  [ts.SyntaxKind.Parameter]: simpleNameWithParent,

  [ts.SyntaxKind.Block]: skipNode,
  [ts.SyntaxKind.YieldExpression]: skipNode,
  [ts.SyntaxKind.ReturnStatement]: skipNode,
});
