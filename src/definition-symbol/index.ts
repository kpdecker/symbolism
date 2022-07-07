import invariant from 'tiny-invariant';
import ts, { findAncestor, SyntaxKind } from 'typescript';
import { dumpNode, dumpSymbol } from '../symbols';
import { getPropertySymbol, isArraySymbol, isErrorType } from '../utils';

type DefinitionSymbol = {
  symbol: ts.Symbol | undefined;
  type: ts.Type | undefined;
};
type DefinitionOperation = (
  node: ts.Node,
  checker: ts.TypeChecker
) => DefinitionSymbol | undefined;

const definitionOperations: DefinitionOperation[] = [
  defineIdentifier,
  defineVariableDeclaration,
  defineParameter,
  defineReturn,
  defineLiteral,
  definePropertyAssignment,
  defineCallReturn,
  defineBindingElement,
  defineBinaryExpression,
  definePassThrough,
];

export function defineSymbol(node: ts.Node, checker: ts.TypeChecker) {
  console.log('defineType', ts.SyntaxKind[node.kind]); //, dumpNode(node, checker));
  for (const operation of definitionOperations) {
    const result = node && operation(node, checker);
    if (result) {
      return result;
    }
  }
  console.warn('failed to infer type', dumpNode(node, checker));
  throw new Error('failed to infer type');
  // return checker.getTypeAtLocation(node);
}

function defineIdentifier(node: ts.Node, checker: ts.TypeChecker) {
  if (ts.isIdentifier(node)) {
    if (ts.isObjectLiteralExpression(node.parent)) {
      const objectType = defineSymbol(node.parent, checker);
      if (!objectType || !objectType.type) {
        return;
      }

      return getPropertySymbol(node, objectType.type, checker, node.getText(), {
        stringIndex: true,
      });
    }
    if (ts.isArrayLiteralExpression(node.parent)) {
      const arrayType = defineSymbol(node.parent, checker);
      if (!arrayType || !arrayType.type) {
        return;
      }

      return getPropertySymbol(
        node,
        arrayType.type,
        checker,
        node.parent.elements.indexOf(node) + '',
        {
          numberIndex: true,
        }
      );
    }

    // Identifier pass through
    if (
      ts.isBindingElement(node.parent) ||
      ts.isPropertyAssignment(node.parent) ||
      ts.isBinaryExpression(node.parent) ||
      ts.isConditionalExpression(node.parent)
    ) {
      return defineSymbol(node.parent, checker);
    }

    // Use the identifier directly
    // TODO: We want to remove this. Making an explicit list for now to identify missed cases
    if (
      ts.isTypeOfExpression(node.parent) ||
      ts.isReturnStatement(node.parent) ||
      ts.isVariableDeclaration(node.parent)
    ) {
      return directTypeAndSymbol(node, checker);
    }

    if (ts.isCallExpression(node.parent)) {
      // Will be picked up by inferParameter
      return;
    }

    console.error('failed to infer identifier', dumpNode(node.parent, checker));
    throw new Error('failed to infer identifier');
  }
}

function defineVariableDeclaration(node: ts.Node, checker: ts.TypeChecker) {
  if (ts.isVariableDeclaration(node)) {
    return directTypeAndSymbol(
      node.type || node.initializer || node.name,
      checker
    );
  }
}

function defineParameter(node: ts.Node, checker: ts.TypeChecker) {
  if (
    (ts.isIdentifier(node) ||
      ts.isObjectLiteralExpression(node) ||
      ts.isArrayLiteralExpression(node)) &&
    ts.isCallOrNewExpression(node.parent)
  ) {
    const parameterIndex = node.parent.arguments?.indexOf(node) ?? -1;
    if (parameterIndex < 0) {
      return;
    }

    const signature = checker.getResolvedSignature(node.parent);
    const parameterSymbol = signature!.parameters[parameterIndex];
    return {
      symbol: parameterSymbol,
      type: checker.getTypeOfSymbolAtLocation(parameterSymbol, node.parent),
    };
  }
}

function defineReturn(node: ts.Node, checker: ts.TypeChecker) {
  if (ts.isReturnStatement(node)) {
    const parent = findAncestor(node, ts.isFunctionLike);
    if (parent?.type) {
      return directTypeAndSymbol(parent.type, checker);
    }

    if (node.expression) {
      return directTypeAndSymbol(node.expression, checker);
    }

    // TODO: Handle no return value
  }
}

function defineLiteral(node: ts.Node, checker: ts.TypeChecker) {
  if (ts.isObjectLiteralExpression(node) || ts.isArrayLiteralExpression(node)) {
    // This is handled by inferParameter
    if (ts.isCallOrNewExpression(node.parent)) {
      return;
    }

    const inferred = defineSymbol(node.parent, checker);
    if (!inferred) {
      return;
    }

    return getArrayType(inferred) || inferred;
  }
}

function definePropertyAssignment(node: ts.Node, checker: ts.TypeChecker) {
  if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
    const objectType = defineSymbol(node.parent, checker);
    if (!objectType || !objectType.type) {
      return;
    }
    const propertyName = node.name.getText();

    return getPropertySymbol(node, objectType.type, checker, propertyName, {
      stringIndex: true,
    });
  }
}

function defineBindingElement(node: ts.Node, checker: ts.TypeChecker) {
  if (ts.isBindingElement(node)) {
    if (node.dotDotDotToken) {
      // Spreads will be a synthetic type, just map directly
      const directInferred = directTypeAndSymbol(node, checker);

      return getArrayType(directInferred) || directInferred;
    }

    const bindingPattern = node.parent;
    const bindingPatternType = defineSymbol(bindingPattern, checker);

    const propertyName = ts.isArrayBindingPattern(bindingPattern)
      ? bindingPattern.elements.indexOf(node) + ''
      : (node.propertyName || node.name).getText();

    return getPropertySymbol(
      node,
      bindingPatternType?.type!,
      checker,
      propertyName,
      {
        stringIndex: ts.isObjectBindingPattern(bindingPattern),
        numberIndex: ts.isArrayBindingPattern(bindingPattern),
      }
    );
  }

  if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
    if (ts.isVariableDeclaration(node.parent)) {
      const variableDeclaration = node.parent;
      return defineSymbol(variableDeclaration, checker);
    }
    throw new Error(
      'unhandled binding pattern: ' + SyntaxKind[node.parent.kind]
    );
  }
}

function defineCallReturn(node: ts.Node, checker: ts.TypeChecker) {
  if (ts.isCallExpression(node)) {
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
}

function defineBinaryExpression(node: ts.Node, checker: ts.TypeChecker) {
  if (ts.isBinaryExpression(node)) {
    // const leftType = inferType(node.left, checker);
    // const rightType = inferType(node.right, checker);
    // if (leftType && rightType) {
    if (ts.isIdentifier(node.left)) {
      const symbol = checker.getSymbolAtLocation(node.left);
      if (symbol) {
        return {
          symbol,
          type: checker.getTypeOfSymbolAtLocation(symbol, node),
        };
      }
    }
    if (ts.isIdentifier(node.right)) {
      const symbol = checker.getSymbolAtLocation(node.right);
      if (symbol) {
        return {
          symbol,
          type: checker.getTypeOfSymbolAtLocation(symbol, node),
        };
      }
    }
    // TODO: WIP
  }
}

function definePassThrough(node: ts.Node, checker: ts.TypeChecker) {
  if (
    ts.isTypeOfExpression(node) ||
    ts.isConditionalExpression(node) ||
    ts.isAsExpression(node)
  ) {
    return defineSymbol(node.parent, checker);
  }
}

function directTypeAndSymbol(node: ts.Node, checker: ts.TypeChecker) {
  const symbol = checker.getSymbolAtLocation(node);
  let type: ts.Type;

  if (symbol) {
    type = checker.getTypeOfSymbolAtLocation(symbol, node);
  } else {
    type = checker.getTypeAtLocation(node);
  }

  return {
    symbol: symbol ? symbol : type.symbol,
    type,
  };
}

function getArrayType(inferred: DefinitionSymbol) {
  const { type, symbol } = inferred;

  // If our parent is an array, we need to get the element type
  if (type && symbol && isArraySymbol(symbol) && type.getNumberIndexType()) {
    const numberIndexType = type.getNumberIndexType();
    return {
      symbol: numberIndexType?.symbol || symbol,
      type: type.getNumberIndexType(),
    };
  }
}
