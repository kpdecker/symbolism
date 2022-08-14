import invariant from "tiny-invariant";
import ts, { JsxOpeningLikeElement } from "typescript";
import { logDebug } from "@symbolism/utils";
import { defineSymbol } from "./index";
import {
  contextualTypeAndSymbol,
  directTypeAndSymbol,
  getPropertySymbol,
  nodeOperators,
} from "./utils";
import { invariantNode } from "@symbolism/ts-utils";
import { dumpNode } from "@symbolism/ts-debug";

export const jsxSymbolHandlers = nodeOperators({
  [ts.SyntaxKind.JsxElement](node, checker, options) {
    invariantNode(node, ts.isJsxElement);
    return defineSymbol(node.openingElement, checker, options);
  },
  [ts.SyntaxKind.JsxOpeningElement]: handleElementDeclaration,
  [ts.SyntaxKind.JsxSelfClosingElement]: handleElementDeclaration,
  [ts.SyntaxKind.JsxClosingElement](node, checker, options) {
    invariantNode(node, ts.isJsxClosingElement);
    return defineSymbol(node.parent, checker, options);
  },

  [ts.SyntaxKind.JsxFragment](node, checker, options) {
    invariantNode(node, ts.isJsxFragment);
    return defineSymbol(node.openingFragment, checker, options);
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
  [ts.SyntaxKind.JsxAttribute](node, checker, options) {
    invariantNode(node, ts.isJsxAttribute);
    const properties = defineSymbol(node.parent, checker, options);
    if (!properties) {
      logDebug(`No properties for ${dumpNode(node.parent, checker)}`);
      return directTypeAndSymbol(node, checker);
    }

    const name = node.name.getText();

    const propertyDefinition = getPropertySymbol(
      node,
      properties.type!,
      checker,
      name,
      {
        stringIndex: true,
      }
    );

    // If the property has an attached property definition, then
    // use that as the symbol is from an implicit property and
    // doesn't have a declaration from the getProperty call.
    if (
      propertyDefinition &&
      (propertyDefinition.symbol as any).bindingElement
    ) {
      const bindingElement: ts.BindingElement = (
        propertyDefinition.symbol as any
      ).bindingElement;
      return directTypeAndSymbol(
        bindingElement.propertyName || bindingElement.name,
        checker
      );
    }

    // isIgnoredJsxProperty
    // https://github.com/microsoft/TypeScript/blob/5d65c4dc26334ec7518d2472a9b3b69dac9ff2b5/src/compiler/checker.ts#L18323-L18325
    if (name.includes("-")) {
      return null;
    }

    return propertyDefinition;
  },
  [ts.SyntaxKind.JsxSpreadAttribute](node, checker, options) {
    invariantNode(node, ts.isJsxSpreadAttribute);
    return defineSymbol(node.expression, checker, options);
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
