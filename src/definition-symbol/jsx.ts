import invariant from 'tiny-invariant';
import ts, { findAncestor } from 'typescript';
import { dumpNode, dumpSymbol } from '../symbols';
import { getPropertySymbol } from '../utils';
import { defineSymbol } from './index';
import { DefinitionSymbol, directTypeAndSymbol } from './utils';

export function defineJSX(
  node: ts.Node,
  checker: ts.TypeChecker
): DefinitionSymbol | null | undefined {
  if (ts.isJsxElement(node)) {
    return defineJSX(node.openingElement, checker);
  }
  if (ts.isJsxAttribute(node)) {
    const properties = defineSymbol(node.parent, checker);
    const name = node.name.getText();
    return getPropertySymbol(node, properties.type!, checker, name, {
      stringIndex: true,
    });
  }

  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
    return directTypeAndSymbol(node.tagName, checker);
  }

  if (ts.isJsxAttributes(node)) {
    const contextType = checker.getContextualType(node);
    if (contextType) {
      return {
        symbol: contextType.symbol,
        type: contextType,
      };
    }
  }

  if (ts.isJsxSpreadAttribute(node)) {
    return defineSymbol(node.expression, checker);
  }
}
