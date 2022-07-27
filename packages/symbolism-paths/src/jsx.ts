import ts from "typescript";
import { invariantNode } from "@symbolism/ts-utils";
import {
  literalText,
  nameWithParent,
  nopPath,
  pathHandler,
  skipNode,
} from "./handlers";

export const jsxPathHandlers = pathHandler({
  [ts.SyntaxKind.JsxElement]: nopPath,
  [ts.SyntaxKind.JsxOpeningElement]({ node, getParentPath }) {
    invariantNode(node, ts.isJsxOpeningElement);
    return getParentPath() + "." + node.tagName.getText();
  },
  [ts.SyntaxKind.JsxSelfClosingElement]({ node, getParentPath }) {
    invariantNode(node, ts.isJsxSelfClosingElement);
    return getParentPath() + "." + node.tagName.getText();
  },
  [ts.SyntaxKind.JsxClosingElement]: skipNode,

  [ts.SyntaxKind.JsxFragment]: skipNode,
  [ts.SyntaxKind.JsxOpeningFragment]: skipNode,
  [ts.SyntaxKind.JsxClosingFragment]: nopPath,

  [ts.SyntaxKind.JsxText]: literalText,
  [ts.SyntaxKind.JsxTextAllWhiteSpaces]: literalText,
  [ts.SyntaxKind.JsxExpression]: nopPath,

  [ts.SyntaxKind.JsxAttributes]: skipNode,
  [ts.SyntaxKind.JsxAttribute]: nameWithParent,
  [ts.SyntaxKind.JsxSpreadAttribute]: nopPath,
});
