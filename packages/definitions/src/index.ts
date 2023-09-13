import ts from "typescript";
import { NodeError, logDebug, assertExists } from "@noom/symbolism-utils";
import { classOperators } from "./class";
import { functionOperators } from "./function";
import { importOperators } from "./import";
import { jsDocHandlers } from "./jsdoc";
import { jsxSymbolHandlers } from "./jsx";
import { tokenOperators } from "./tokens";
import {
  contextualTypeAndSymbol,
  getPropertySymbol,
  DefinitionOperation,
  directTypeAndSymbol,
  getArrayType,
  DefinitionOptions,
  DefinitionSymbol,
  deferred,
} from "./utils";
import { followSymbol } from "./follow-symbol";
import {
  getSymbolDeclaration,
  invariantNode,
  isAssignmentExpression,
  isNamedDeclaration,
  isTypeReference,
} from "@noom/symbolism-ts-utils";

export type { DefinitionSymbol } from "./utils";

function nopHandler() {
  return null;
}

const nodeHandlers: Record<ts.SyntaxKind, DefinitionOperation> = {
  [ts.SyntaxKind.SourceFile]: directTypeAndSymbol,

  // Low level tokens
  ...tokenOperators,

  // Intrinsic Values
  [ts.SyntaxKind.NullKeyword]: directTypeAndSymbol,
  [ts.SyntaxKind.NumericLiteral]: directTypeAndSymbol,
  [ts.SyntaxKind.Unknown]: directTypeAndSymbol,
  [ts.SyntaxKind.BigIntLiteral]: directTypeAndSymbol,
  [ts.SyntaxKind.StringLiteral]: directTypeAndSymbol,
  [ts.SyntaxKind.RegularExpressionLiteral]: directTypeAndSymbol,
  [ts.SyntaxKind.NoSubstitutionTemplateLiteral]: directTypeAndSymbol,
  [ts.SyntaxKind.TrueKeyword]: directTypeAndSymbol,
  [ts.SyntaxKind.FalseKeyword]: directTypeAndSymbol,
  [ts.SyntaxKind.NullKeyword]: directTypeAndSymbol,
  [ts.SyntaxKind.VoidExpression]: directTypeAndSymbol,

  // References
  [ts.SyntaxKind.Identifier]: defineIdentifier,
  [ts.SyntaxKind.QualifiedName]: defineIdentifier, // JSDoc

  // Expressions
  [ts.SyntaxKind.ArrayLiteralExpression]: contextualTypeAndSymbol,
  [ts.SyntaxKind.SpreadElement](node, checker, options) {
    invariantNode(node, checker, ts.isSpreadElement);
    return defineSymbol(node.expression, checker, options);
  },
  [ts.SyntaxKind.ObjectLiteralExpression]: contextualTypeAndSymbol,
  [ts.SyntaxKind.PropertyAccessExpression]: defineProperties,
  [ts.SyntaxKind.PropertyAssignment]: defineProperties,
  [ts.SyntaxKind.ShorthandPropertyAssignment]: defineProperties,
  [ts.SyntaxKind.SpreadAssignment]: defineProperties,
  [ts.SyntaxKind.ComputedPropertyName]: directTypeAndSymbol,

  [ts.SyntaxKind.ElementAccessExpression]: defineProperties,
  [ts.SyntaxKind.ParenthesizedExpression](node, checker, options) {
    invariantNode(node, checker, ts.isParenthesizedExpression);
    return defineSymbol(node.expression, checker, options);
  },
  [ts.SyntaxKind.DeleteExpression]: directTypeAndSymbol,
  [ts.SyntaxKind.AwaitExpression]: directTypeAndSymbol,
  [ts.SyntaxKind.PrefixUnaryExpression]: directTypeAndSymbol,
  [ts.SyntaxKind.PostfixUnaryExpression]: directTypeAndSymbol,
  [ts.SyntaxKind.BinaryExpression](node, checker) {
    invariantNode(node, checker, ts.isBinaryExpression);

    if (isAssignmentExpression(node)) {
      const left = contextualTypeAndSymbol(node.left, checker);
      const right = contextualTypeAndSymbol(node.right, checker);

      // Select whoever has a type, giving LHS priority
      return left?.symbol?.declarations && left?.symbol?.declarations.length > 0
        ? left
        : right;
    }

    return directTypeAndSymbol(node, checker);
  },
  [ts.SyntaxKind.ConditionalExpression]: directTypeAndSymbol,
  [ts.SyntaxKind.TemplateExpression]: directTypeAndSymbol,
  [ts.SyntaxKind.OmittedExpression]: nopHandler,
  [ts.SyntaxKind.AsExpression]: directTypeAndSymbol,
  [ts.SyntaxKind.TypeAssertionExpression]: directTypeAndSymbol,
  [ts.SyntaxKind.NonNullExpression](node, checker, options) {
    invariantNode(node, checker, ts.isNonNullExpression);
    return defineSymbol(node.expression, checker, options);
  },
  [ts.SyntaxKind.CommaListExpression]: directTypeAndSymbol,

  [ts.SyntaxKind.TaggedTemplateExpression]: defineTaggedTemplate,
  [ts.SyntaxKind.TemplateHead]: directTypeAndSymbol,
  [ts.SyntaxKind.TemplateMiddle]: directTypeAndSymbol,
  [ts.SyntaxKind.TemplateTail]: directTypeAndSymbol,
  [ts.SyntaxKind.TemplateSpan]: directTypeAndSymbol,

  // Statements
  [ts.SyntaxKind.ExpressionStatement](node, checker, options) {
    invariantNode(node, checker, ts.isExpressionStatement);
    return defineSymbol(node.expression, checker, options);
  },
  [ts.SyntaxKind.EmptyStatement]: nopHandler,
  [ts.SyntaxKind.VariableStatement]: nopHandler,
  [ts.SyntaxKind.IfStatement]: nopHandler,
  [ts.SyntaxKind.DoStatement]: nopHandler,
  [ts.SyntaxKind.WhileStatement]: nopHandler,
  [ts.SyntaxKind.ForStatement]: nopHandler,
  [ts.SyntaxKind.ForInStatement]: nopHandler,
  [ts.SyntaxKind.ForOfStatement]: nopHandler,
  [ts.SyntaxKind.LabeledStatement]: nopHandler,
  [ts.SyntaxKind.ThrowStatement](node, checker, options) {
    invariantNode(node, checker, ts.isThrowStatement);
    return defineSymbol(node.expression, checker, options);
  },
  [ts.SyntaxKind.ContinueStatement]: nopHandler,
  [ts.SyntaxKind.BreakStatement]: nopHandler,
  [ts.SyntaxKind.WithStatement]: nopHandler,
  [ts.SyntaxKind.TryStatement]: nopHandler,
  [ts.SyntaxKind.CatchClause]: nopHandler,
  [ts.SyntaxKind.DebuggerStatement]: nopHandler,

  [ts.SyntaxKind.SwitchStatement]: nopHandler,
  [ts.SyntaxKind.CaseClause]: nopHandler,
  [ts.SyntaxKind.DefaultClause]: nopHandler,
  [ts.SyntaxKind.CaseBlock]: nopHandler,

  // Declarations
  [ts.SyntaxKind.Decorator]: directTypeAndSymbol,

  [ts.SyntaxKind.ObjectBindingPattern]: defineBindingElement,
  [ts.SyntaxKind.ArrayBindingPattern]: defineBindingElement,
  [ts.SyntaxKind.BindingElement]: defineBindingElement,

  [ts.SyntaxKind.VariableDeclaration]: defineVariableDeclaration,
  [ts.SyntaxKind.VariableDeclarationList]: directTypeAndSymbol,

  [ts.SyntaxKind.EnumDeclaration](node, checker) {
    invariantNode(node, checker, ts.isEnumDeclaration);
    return directTypeAndSymbol(node.name, checker);
  },
  [ts.SyntaxKind.EnumMember](node, checker, options) {
    invariantNode(node, checker, ts.isEnumMember);
    const parentDefinition = defineSymbol(node.parent, checker, options);
    const type = parentDefinition?.getType();
    if (!type) {
      return directTypeAndSymbol(node.name, checker);
    }

    return getPropertySymbol(node, type, checker, node.name.getText());
  },
  [ts.SyntaxKind.SyntaxList](node, checker, options) {
    return defineSymbol(node.parent, checker, options);
  },

  // Type Declarations
  [ts.SyntaxKind.ConstructSignature]: directTypeAndSymbol,
  [ts.SyntaxKind.IndexSignature]: directTypeAndSymbol,
  [ts.SyntaxKind.TypePredicate]: directTypeAndSymbol,
  [ts.SyntaxKind.TypeReference]: directTypeAndSymbol,
  [ts.SyntaxKind.FunctionType]: directTypeAndSymbol,
  [ts.SyntaxKind.ConstructorType]: directTypeAndSymbol,
  [ts.SyntaxKind.TypeQuery](node, checker, options) {
    invariantNode(node, checker, ts.isTypeQueryNode);
    return defineSymbol(node.exprName, checker, options);
  },
  [ts.SyntaxKind.TypeLiteral]: directTypeAndSymbol,
  [ts.SyntaxKind.ArrayType]: directTypeAndSymbol,
  [ts.SyntaxKind.TupleType]: directTypeAndSymbol,
  [ts.SyntaxKind.OptionalType]: directTypeAndSymbol,
  [ts.SyntaxKind.RestType]: directTypeAndSymbol,
  [ts.SyntaxKind.UnionType]: directTypeAndSymbol,
  [ts.SyntaxKind.IntersectionType]: directTypeAndSymbol,
  [ts.SyntaxKind.ConditionalType]: directTypeAndSymbol,
  [ts.SyntaxKind.InferType]: directTypeAndSymbol,
  [ts.SyntaxKind.ParenthesizedType]: directTypeAndSymbol,
  [ts.SyntaxKind.ThisType]: directTypeAndSymbol,
  [ts.SyntaxKind.TypeOperator]: directTypeAndSymbol,
  [ts.SyntaxKind.IndexedAccessType]: directTypeAndSymbol,
  [ts.SyntaxKind.MappedType]: directTypeAndSymbol,
  [ts.SyntaxKind.LiteralType]: directTypeAndSymbol,
  [ts.SyntaxKind.NamedTupleMember]: directTypeAndSymbol,
  [ts.SyntaxKind.TemplateLiteralType]: directTypeAndSymbol,
  [ts.SyntaxKind.TemplateLiteralTypeSpan]: directTypeAndSymbol,
  [ts.SyntaxKind.InterfaceDeclaration]: directTypeAndSymbol,
  [ts.SyntaxKind.TypeAliasDeclaration](node, checker) {
    invariantNode(node, checker, ts.isTypeAliasDeclaration);
    return directTypeAndSymbol(node.name, checker);
  },
  [ts.SyntaxKind.ModuleDeclaration]: directTypeAndSymbol,
  [ts.SyntaxKind.ModuleBlock]: directTypeAndSymbol,
  [ts.SyntaxKind.TypeOfExpression]: directTypeAndSymbol,
  [ts.SyntaxKind.CallSignature]: directTypeAndSymbol,
  [ts.SyntaxKind.MethodSignature]: directTypeAndSymbol,
  [ts.SyntaxKind.TypeParameter]: directTypeAndSymbol,

  // Error Constructs
  [ts.SyntaxKind.MissingDeclaration]: nopHandler,
  [ts.SyntaxKind.UnparsedPrologue]: nopHandler,
  [ts.SyntaxKind.UnparsedPrepend]: nopHandler,
  [ts.SyntaxKind.UnparsedText]: nopHandler,
  [ts.SyntaxKind.UnparsedInternalText]: nopHandler,
  [ts.SyntaxKind.UnparsedSyntheticReference]: nopHandler,

  // Not Printed Constructs
  [ts.SyntaxKind.Bundle]: nopHandler,
  [ts.SyntaxKind.UnparsedSource]: nopHandler,
  [ts.SyntaxKind.InputFiles]: nopHandler,
  [ts.SyntaxKind.NotEmittedStatement]: nopHandler,
  [ts.SyntaxKind.PartiallyEmittedExpression]: nopHandler,
  [ts.SyntaxKind.SyntheticExpression]: nopHandler,
  [ts.SyntaxKind.SyntheticReferenceExpression]: nopHandler,
  [ts.SyntaxKind.Count]: nopHandler,

  // Misc
  [ts.SyntaxKind.MergeDeclarationMarker]: nopHandler,
  [ts.SyntaxKind.EndOfDeclarationMarker]: nopHandler,

  ...importOperators,
  ...functionOperators,
  ...classOperators,
  ...jsDocHandlers,
  ...jsxSymbolHandlers,
};

export function defineSymbol(
  node: ts.Node | undefined,
  checker: ts.TypeChecker,
  options: { chooseLocal?: boolean } = {}
) {
  if (!node) {
    return undefined;
  }

  logDebug(
    "defineSymbol",
    ts.SyntaxKind[node.kind],
    ts.isIdentifier(node) ? node.getText() : ""
    //, dumpNode(node, checker)
  );

  try {
    const nodeHandler = nodeHandlers[node.kind];
    if (nodeHandler) {
      return nodeHandler(node, checker, options);
    } else {
      throw new NodeError("Failed to infer type", node, checker);
    }
  } catch (err) {
    throw new NodeError(`Error in defineSymbol`, node, checker, err as Error);
  }
}

function defineIdentifier(
  node: ts.Node,
  checker: ts.TypeChecker,
  options: DefinitionOptions
) {
  if (ts.isIdentifier(node)) {
    if (
      !options.chooseLocal &&
      (ts.isArrayLiteralExpression(node.parent) ||
        ts.isCallExpression(node.parent) ||
        ts.isNewExpression(node.parent))
    ) {
      const contextSymbol = contextualTypeAndSymbol(node, checker);
      const contextType = contextSymbol?.getType();
      if (
        contextType &&
        !(contextType?.getFlags() & ts.TypeFlags.Any) &&
        // Failover to what has a symbol since that can be tracked
        contextType.symbol
      ) {
        return followSymbol(contextSymbol, checker, options);
      }
    }

    // Don't emit anything when we are the property assignment name
    if (ts.isPropertyAssignment(node.parent)) {
      if (node.parent.name === node) {
        return null;
      }
    }

    // Default imports
    if (ts.isImportClause(node.parent) && node.parent.name === node) {
      const parentDefinition = defineSymbol(node.parent, checker, options);
      if (parentDefinition) {
        const defaultSymbol = parentDefinition
          .getType()
          ?.getProperty("default");
        const defaultDeclaration = getSymbolDeclaration(defaultSymbol);
        if (defaultDeclaration) {
          return followSymbol(
            {
              symbol: defaultSymbol,
              declaration: defaultDeclaration,
              getType: deferred(() =>
                checker.getTypeOfSymbolAtLocation(
                  // @ts-expect-error TS is dumb
                  defaultSymbol,
                  defaultDeclaration
                )
              ),
            },
            checker,
            options
          );
        }
      }
    }

    // Identifier pass through
    if (
      (isNamedDeclaration(node.parent) && node.parent.name === node) ||
      (isAssignmentExpression(node.parent) && node.parent.left === node)
    ) {
      const parentDefinition = defineSymbol(node.parent, checker, options);

      // Declarations can be missing when imp
      if (parentDefinition && parentDefinition.declaration) {
        return parentDefinition;
      }
    }

    return followSymbol(directTypeAndSymbol(node, checker), checker, options);
  }
}

function defineVariableDeclaration(node: ts.Node, checker: ts.TypeChecker) {
  invariantNode(node, checker, ts.isVariableDeclaration);
  return directTypeAndSymbol(node.name, checker);
}

function defineProperties(
  node: ts.Node,
  checker: ts.TypeChecker,
  options: DefinitionOptions
): DefinitionSymbol | null | undefined {
  if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
    const objectDefinition = defineSymbol(node.parent, checker, options);
    const objectType = objectDefinition?.getType();
    if (!objectType) {
      return;
    }
    const propertyName = node.name.getText();

    const propertyDefinition = getPropertySymbol(
      node,
      objectType,
      checker,
      propertyName,
      {
        stringIndex: true,
      }
    );

    if (
      (!propertyDefinition?.symbol || options.chooseLocal) &&
      ts.isShorthandPropertyAssignment(node)
    ) {
      const shorthandSymbol = checker.getShorthandAssignmentValueSymbol(node);
      if (shorthandSymbol) {
        return followSymbol(
          {
            symbol: shorthandSymbol,
            declaration: getSymbolDeclaration(shorthandSymbol),
            getType: deferred(() =>
              checker.getTypeOfSymbolAtLocation(shorthandSymbol, node)
            ),
          },
          checker,
          options
        );
      }

      return directTypeAndSymbol(node.name, checker);
    }

    return propertyDefinition;
  }
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node)
  ) {
    const type = directTypeAndSymbol(node, checker);
    const typeDeclaration = type.symbol?.declarations?.[0];

    // Check to see if we can resolve the property into ancestors.
    if (
      typeDeclaration &&
      (ts.isMethodDeclaration(typeDeclaration) ||
        ts.isPropertyDeclaration(typeDeclaration))
    ) {
      return defineSymbol(typeDeclaration, checker, options);
    }

    return type;
  }
}

function defineBindingElement(
  node: ts.Node,
  checker: ts.TypeChecker,
  options: DefinitionOptions
) {
  if (ts.isBindingElement(node)) {
    if (node.dotDotDotToken) {
      // Spreads will be a synthetic type, just map directly
      const directInferred = directTypeAndSymbol(node, checker);

      return getArrayType(directInferred) || directInferred;
    }

    const bindingPattern = node.parent;
    const bindingPatternDefinition = defineSymbol(
      bindingPattern,
      checker,
      options
    );

    const propertyName = ts.isArrayBindingPattern(bindingPattern)
      ? bindingPattern.elements.indexOf(node) + ""
      : (node.propertyName || node.name).getText();

    // This supports tuple types. Unclear on others
    const bindingPatternType = bindingPatternDefinition?.getType();
    if (bindingPatternType && isTypeReference(bindingPatternType)) {
      const typeArguments = checker.getTypeArguments(bindingPatternType);
      const typeArgument = typeArguments[+propertyName] || typeArguments[0];
      if (typeArgument && !(typeArgument.getFlags() & ts.TypeFlags.Any)) {
        return {
          symbol: typeArgument.symbol,
          declaration: getSymbolDeclaration(typeArgument.symbol),
          getType: () => typeArgument,
        };
      }
    }

    const propertyDefinition = getPropertySymbol(
      node,
      assertExists(bindingPatternType),
      checker,
      propertyName,
      {
        stringIndex: ts.isObjectBindingPattern(bindingPattern),
        numberIndex: ts.isArrayBindingPattern(bindingPattern),
      }
    );

    // The type resolved to an intrinsic type. This is likely
    // a declaration without further typing. Attempt to resolve
    // via the name identifier.
    if (!propertyDefinition?.symbol?.declarations?.length) {
      return directTypeAndSymbol(node.name, checker);
    }

    return propertyDefinition;
  }

  if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
    if (
      ts.isVariableDeclaration(node.parent) ||
      ts.isParameter(node.parent) ||
      ts.isBindingElement(node.parent)
    ) {
      return followSymbol(
        defineSymbol(node.parent, checker, options),
        checker,
        options
      );
    }

    invariantNode(node.parent, checker);
  }
}

function defineTaggedTemplate(node: ts.Node, checker: ts.TypeChecker) {
  if (ts.isTaggedTemplateExpression(node)) {
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
