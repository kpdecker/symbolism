import invariant from 'tiny-invariant';
import ts, { findAncestor } from 'typescript';

/**
 * Resolves the symbol for a JSX attribute, resolving all types and symbols.
 */
export function getSymbolForJSXAttribute(
  attrNode: ts.JsxAttribute,
  checker: ts.TypeChecker
) {
  const element: ts.JsxOpeningElement | ts.JsxSelfClosingElement | undefined =
    findAncestor(
      attrNode,
      (node) => ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)
    ) as ts.JsxOpeningElement | ts.JsxSelfClosingElement;
  invariant(element);

  const name = attrNode.name.getText();

  // Creates a transient type with all generics resolved. This
  // is the final type used for assertions.
  const signature = checker.getResolvedSignature(element);
  const propsParameter = signature?.getParameters()[0];
  invariant(propsParameter);

  return resolveObjectTypeProperty(propsParameter, name, checker);
}

function resolveObjectTypeProperty(
  objectSymbol: ts.Symbol,
  name: string,
  checker: ts.TypeChecker
) {
  // TODO: checker.getTypeOfSymbolAtLocation?
  if ((ts as any).isTransientSymbol(objectSymbol)) {
    const type: ts.Type = (objectSymbol as any).type;
    return type.getProperty(name);
  }
  console.error('Unknown object symbol type', objectSymbol);
  throw new Error('Unknown object symbol type');
}
