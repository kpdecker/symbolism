import {
  getSymbolDeclaration,
  invariantNode,
  tryGetThisTypeAt,
} from "@noom/symbolism-ts-utils";
import ts, { findAncestor } from "typescript";
import { defineSymbol } from "./index";
import {
  collectAllAncestorTypes,
  directTypeAndSymbol,
  getPropertySymbol,
  nodeOperators,
} from "./utils";

export const classOperators = nodeOperators({
  [ts.SyntaxKind.OverrideKeyword](node, checker) {
    return directTypeAndSymbol(node.parent, checker);
  },
  [ts.SyntaxKind.SuperKeyword]: directTypeAndSymbol,
  [ts.SyntaxKind.ThisKeyword](node, checker, options) {
    // Internal API: Couldn't find any other way to resolve proper type
    // consistently.
    const thisType = tryGetThisTypeAt(checker, node);
    if (thisType) {
      return {
        symbol: thisType.symbol,
        declaration: getSymbolDeclaration(thisType.symbol),
        getType: () => thisType,
      };
    }

    const classNode = findAncestor(node, ts.isClassLike);

    // Hit the container class directly if we are able to.
    // The built in resolution can be hit or miss on what is returned.
    if (classNode) {
      return defineSymbol(classNode, checker, options);
    }

    return directTypeAndSymbol(node, checker);
  },

  [ts.SyntaxKind.HeritageClause]: directTypeAndSymbol, // extends/implements
  [ts.SyntaxKind.ExpressionWithTypeArguments]: directTypeAndSymbol,

  [ts.SyntaxKind.PrivateIdentifier]: directTypeAndSymbol,

  [ts.SyntaxKind.ClassExpression](node, checker) {
    return directTypeAndSymbol(node.parent, checker);
  },
  [ts.SyntaxKind.ClassDeclaration]: directTypeAndSymbol,
  [ts.SyntaxKind.Constructor](node, checker) {
    invariantNode(node, checker, ts.isConstructorDeclaration);
    return directTypeAndSymbol(node.parent, checker);
  },
  [ts.SyntaxKind.MethodDeclaration]: handleClassFieldDeclaration,
  [ts.SyntaxKind.PropertyDeclaration]: handleClassFieldDeclaration,
  [ts.SyntaxKind.ClassStaticBlockDeclaration]: () => undefined,

  [ts.SyntaxKind.GetAccessor](node, checker) {
    invariantNode(node, checker, ts.isGetAccessor);
    return directTypeAndSymbol(node.name, checker);
  },
  [ts.SyntaxKind.SetAccessor](node, checker) {
    invariantNode(node, checker, ts.isSetAccessor);
    return directTypeAndSymbol(node.name, checker);
  },

  [ts.SyntaxKind.SemicolonClassElement]: () => undefined,

  // Type
  [ts.SyntaxKind.PropertySignature](node, checker) {
    invariantNode(node, checker, ts.isPropertySignature);
    return directTypeAndSymbol(node.name, checker);
  },
});

function handleClassFieldDeclaration(node: ts.Node, checker: ts.TypeChecker) {
  invariantNode(node, checker, ts.isClassElement);

  const nameNode = node.name;
  if (!nameNode) {
    return directTypeAndSymbol(node, checker);
  }

  const ret = directTypeAndSymbol(nameNode, checker);
  if (ret) {
    const declaration = ret.symbol?.declarations?.[0];
    if (declaration === node) {
      // Walk through heritage clauses to see if we have any upstream
      // interfaces defining this property.
      const ancestorsWithProperty = collectAllAncestorTypes(
        node.parent,
        checker
      )
        .map((type) => {
          if (type.getProperty(nameNode.getText())) {
            return type;
          }
        })
        .filter(Boolean);

      if (ancestorsWithProperty?.[0]) {
        return getPropertySymbol(
          node,
          ancestorsWithProperty[0],
          checker,
          node.name.getText()
        );
      }

      return ret;
    }
  }
}
