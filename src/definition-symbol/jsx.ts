import invariant from "tiny-invariant";
import ts, { findAncestor, JsxOpeningLikeElement } from "typescript";
import { getPropertySymbol } from "../utils";
import { defineSymbol } from "./index";
import {
  contextualTypeAndSymbol,
  directTypeAndSymbol,
  invariantNode,
  nodeOperators,
} from "./utils";

export const jsxSymbolHandlers = nodeOperators({
  [ts.SyntaxKind.JsxElement](node, checker) {
    invariantNode(node, ts.isJsxElement);
    return defineSymbol(node.openingElement, checker);
  },
  [ts.SyntaxKind.JsxOpeningElement]: handleElementDeclaration,
  [ts.SyntaxKind.JsxSelfClosingElement]: handleElementDeclaration,
  [ts.SyntaxKind.JsxClosingElement](node, checker) {
    invariantNode(node, ts.isJsxClosingElement);
    return defineSymbol(node.parent, checker);
  },

  [ts.SyntaxKind.JsxFragment](node, checker) {
    invariantNode(node, ts.isJsxFragment);
    return defineSymbol(node.openingFragment, checker);
  },
  [ts.SyntaxKind.JsxOpeningFragment]: directTypeAndSymbol,
  [ts.SyntaxKind.JsxClosingFragment]: directTypeAndSymbol,

  [ts.SyntaxKind.JsxText]: directTypeAndSymbol,
  [ts.SyntaxKind.JsxTextAllWhiteSpaces]: directTypeAndSymbol,
  [ts.SyntaxKind.JsxExpression](node, checker) {
    invariantNode(node, ts.isJsxExpression);
    invariant(node.expression);
    return directTypeAndSymbol(node.expression, checker);
  },

  [ts.SyntaxKind.JsxAttributes]: contextualTypeAndSymbol,
  [ts.SyntaxKind.JsxAttribute](node, checker) {
    invariantNode(node, ts.isJsxAttribute);
    const properties = defineSymbol(node.parent, checker);
    if (!properties) {
      return directTypeAndSymbol(node, checker);
    }

    const name = node.name.getText();
    return getPropertySymbol(node, properties.type!, checker, name, {
      stringIndex: true,
    });
  },
  [ts.SyntaxKind.JsxSpreadAttribute](node, checker) {
    invariantNode(node, ts.isJsxSpreadAttribute);
    return defineSymbol(node.expression, checker);
  },
});

function handleElementDeclaration(node: ts.Node, checker: ts.TypeChecker) {
  invariantNode(
    node,
    (node): node is JsxOpeningLikeElement =>
      ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)
  );
  return directTypeAndSymbol(node.tagName, checker);
}
