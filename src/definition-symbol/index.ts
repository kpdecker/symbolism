import ts from "typescript";
import { NodeError } from "../error";
import { logDebug, logVerbose } from "../logger";
import { dumpNode, dumpSymbol } from "../symbols";
import { getPropertySymbol, isArraySymbol, isErrorType } from "../utils";
import { classOperators } from "./class";
import { functionOperators } from "./function";
import { jsDocHandlers } from "./jsdoc";
import { jsxSymbolHandlers } from "./jsx";
import { tokenOperators } from "./tokens";
import {
  contextualTypeAndSymbol,
  DefinitionOperation,
  directTypeAndSymbol,
  followSymbol,
  getArrayType,
  invariantNode,
  isNamedDeclaration,
} from "./utils";

function nopHandler() {
  return null;
}

// TODO: Remove partial once fully spec
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
  [ts.SyntaxKind.SpreadElement](node, checker) {
    invariantNode(node, ts.isSpreadElement);
    return defineSymbol(node.expression, checker);
  },
  [ts.SyntaxKind.ObjectLiteralExpression]: contextualTypeAndSymbol,
  [ts.SyntaxKind.PropertyAccessExpression]: defineProperties,
  [ts.SyntaxKind.PropertyAssignment]: defineProperties,
  [ts.SyntaxKind.ShorthandPropertyAssignment]: defineProperties,
  [ts.SyntaxKind.SpreadAssignment]: defineProperties,
  [ts.SyntaxKind.ComputedPropertyName]: directTypeAndSymbol,

  [ts.SyntaxKind.ElementAccessExpression]: defineProperties,
  [ts.SyntaxKind.ParenthesizedExpression](node, checker) {
    invariantNode(node, ts.isParenthesizedExpression);
    return defineSymbol(node.expression, checker);
  },
  [ts.SyntaxKind.DeleteExpression]: directTypeAndSymbol,
  [ts.SyntaxKind.AwaitExpression]: directTypeAndSymbol,
  [ts.SyntaxKind.PrefixUnaryExpression]: directTypeAndSymbol,
  [ts.SyntaxKind.PostfixUnaryExpression]: directTypeAndSymbol,
  [ts.SyntaxKind.BinaryExpression](node, checker) {
    invariantNode(node, ts.isBinaryExpression);

    switch (node.operatorToken.kind) {
      case ts.SyntaxKind.PlusEqualsToken:
      case ts.SyntaxKind.MinusEqualsToken:
      case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
      case ts.SyntaxKind.AsteriskEqualsToken:
      case ts.SyntaxKind.SlashEqualsToken:
      case ts.SyntaxKind.PercentEqualsToken:
      case ts.SyntaxKind.AmpersandEqualsToken:
      case ts.SyntaxKind.BarEqualsToken:
      case ts.SyntaxKind.CaretEqualsToken:
      //
      case ts.SyntaxKind.LessThanLessThanEqualsToken:
      case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
      case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
      case ts.SyntaxKind.BarBarEqualsToken:
      case ts.SyntaxKind.AmpersandAmpersandEqualsToken:
      case ts.SyntaxKind.QuestionQuestionEqualsToken:
      case ts.SyntaxKind.EqualsToken:
      case ts.SyntaxKind.AmpersandAmpersandEqualsToken:
      case ts.SyntaxKind.BarBarEqualsToken:
      case ts.SyntaxKind.QuestionQuestionEqualsToken:
      case ts.SyntaxKind.EqualsToken:
      case ts.SyntaxKind.PlusEqualsToken:
      case ts.SyntaxKind.MinusEqualsToken: {
        const left = contextualTypeAndSymbol(node.left, checker);
        const right = contextualTypeAndSymbol(node.right, checker);

        // Select whoever has a type, giving LHS priority
        return left.symbol?.declarations && left.symbol?.declarations.length > 0
          ? left
          : right;
      }

      default:
        return directTypeAndSymbol(node, checker);
    }
  },
  [ts.SyntaxKind.ConditionalExpression]: directTypeAndSymbol,
  [ts.SyntaxKind.TemplateExpression]: directTypeAndSymbol,
  [ts.SyntaxKind.OmittedExpression]: nopHandler,
  [ts.SyntaxKind.AsExpression]: directTypeAndSymbol,
  [ts.SyntaxKind.TypeAssertionExpression]: directTypeAndSymbol,
  [ts.SyntaxKind.NonNullExpression](node, checker) {
    invariantNode(node, ts.isNonNullExpression);
    return defineSymbol(node.expression, checker);
  },
  [ts.SyntaxKind.CommaListExpression]: directTypeAndSymbol,

  [ts.SyntaxKind.TaggedTemplateExpression]: defineTaggedTemplate,
  [ts.SyntaxKind.TemplateHead]: directTypeAndSymbol,
  [ts.SyntaxKind.TemplateMiddle]: directTypeAndSymbol,
  [ts.SyntaxKind.TemplateTail]: directTypeAndSymbol,
  [ts.SyntaxKind.TemplateSpan]: directTypeAndSymbol,

  // Statements
  [ts.SyntaxKind.ExpressionStatement]: (
    node: ts.Node,
    checker: ts.TypeChecker
  ) => {
    invariantNode(node, ts.isExpressionStatement);
    return defineSymbol(node.expression, checker);
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
  [ts.SyntaxKind.ThrowStatement](node, checker) {
    invariantNode(node, ts.isThrowStatement);
    return defineSymbol(node.expression, checker);
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
    invariantNode(node, ts.isEnumDeclaration);
    return directTypeAndSymbol(node.name, checker);
  },
  [ts.SyntaxKind.EnumMember](node, checker) {
    invariantNode(node, ts.isEnumMember);
    const parentDefinition = defineSymbol(node.parent, checker);
    const type = parentDefinition?.type;
    debugger;
    if (!type) {
      return directTypeAndSymbol(node.name, checker);
    }

    return getPropertySymbol(node, type, checker, node.name.getText());
  },
  [ts.SyntaxKind.SyntaxList](node, checker) {
    return defineSymbol(node.parent, checker);
  },

  // Type Declarations
  [ts.SyntaxKind.ConstructSignature]: directTypeAndSymbol,
  [ts.SyntaxKind.IndexSignature]: directTypeAndSymbol,
  [ts.SyntaxKind.TypePredicate]: directTypeAndSymbol,
  [ts.SyntaxKind.TypeReference]: directTypeAndSymbol,
  [ts.SyntaxKind.FunctionType]: directTypeAndSymbol,
  [ts.SyntaxKind.ConstructorType]: directTypeAndSymbol,
  [ts.SyntaxKind.TypeQuery]: directTypeAndSymbol,
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
    invariantNode(node, ts.isTypeAliasDeclaration);
    return directTypeAndSymbol(node.name, checker);
  },
  [ts.SyntaxKind.ModuleDeclaration]: directTypeAndSymbol,
  [ts.SyntaxKind.ModuleBlock]: directTypeAndSymbol,
  [ts.SyntaxKind.TypeOfExpression]: directTypeAndSymbol,
  [ts.SyntaxKind.CallSignature]: directTypeAndSymbol,
  [ts.SyntaxKind.MethodSignature]: directTypeAndSymbol,
  [ts.SyntaxKind.TypeParameter]: directTypeAndSymbol,

  // Import/Export
  [ts.SyntaxKind.ImportType]: directTypeAndSymbol,
  [ts.SyntaxKind.NamespaceExportDeclaration]: directTypeAndSymbol,
  [ts.SyntaxKind.ImportEqualsDeclaration]: directTypeAndSymbol,
  [ts.SyntaxKind.ImportDeclaration]: directTypeAndSymbol,
  [ts.SyntaxKind.ImportClause]: directTypeAndSymbol,
  [ts.SyntaxKind.NamespaceImport]: directTypeAndSymbol,
  [ts.SyntaxKind.NamedImports]: directTypeAndSymbol,
  [ts.SyntaxKind.ImportSpecifier]: directTypeAndSymbol,
  [ts.SyntaxKind.ExportAssignment]: directTypeAndSymbol,
  [ts.SyntaxKind.ExportDeclaration]: directTypeAndSymbol,
  [ts.SyntaxKind.NamedExports]: directTypeAndSymbol,
  [ts.SyntaxKind.NamespaceExport]: directTypeAndSymbol,
  [ts.SyntaxKind.ExportSpecifier]: directTypeAndSymbol,
  [ts.SyntaxKind.ExternalModuleReference]: directTypeAndSymbol,
  [ts.SyntaxKind.ImportTypeAssertionContainer]: directTypeAndSymbol,
  [ts.SyntaxKind.AssertClause]: directTypeAndSymbol,
  [ts.SyntaxKind.AssertEntry]: directTypeAndSymbol,
  [ts.SyntaxKind.MetaProperty]: directTypeAndSymbol, // import.foo

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

  ...functionOperators,
  ...classOperators,
  ...jsDocHandlers,
  ...jsxSymbolHandlers,
};

export function defineSymbol(node: ts.Node, checker: ts.TypeChecker) {
  logDebug("defineSymbol", ts.SyntaxKind[node.kind]); //, dumpNode(node, checker));

  try {
    const nodeHandler = nodeHandlers[node.kind];
    if (nodeHandler) {
      return nodeHandler(node, checker);
    }
  } catch (err) {
    if ((err as NodeError).isNodeError) {
      throw err;
    }
    throw new NodeError(`Error in defineSymbol`, node, checker, err as Error);
  }

  console.warn("failed to infer type", dumpNode(node, checker));
  invariantNode(node);
}

function defineIdentifier(node: ts.Node, checker: ts.TypeChecker) {
  if (ts.isIdentifier(node)) {
    if (
      ts.isObjectLiteralExpression(node.parent) ||
      ts.isArrayLiteralExpression(node.parent) ||
      ts.isCallExpression(node.parent) ||
      ts.isNewExpression(node.parent) ||
      ts.isArrowFunction(node.parent)
    ) {
      const contextSymbol = contextualTypeAndSymbol(node, checker);
      const contextType = contextSymbol.type;
      if (contextType && !(contextType?.getFlags() & ts.TypeFlags.Any)) {
        return contextSymbol;
      }
    }

    // Don't emit anything when we are the property assignment name
    if (ts.isPropertyAssignment(node.parent)) {
      if (node.parent.name === node) {
        return null;
      }
    }

    // Identifier pass through
    if (
      (isNamedDeclaration(node.parent) && node.parent.name === node) ||
      ts.isBindingElement(node.parent) ||
      ts.isPropertyAssignment(node.parent) ||
      ts.isPropertyAccessExpression(node.parent) ||
      ts.isEnumMember(node.parent) ||
      ts.isBinaryExpression(node.parent) ||
      ts.isConditionalExpression(node.parent) ||
      ts.isVariableDeclaration(node.parent) ||
      ts.isJsxAttribute(node.parent) ||
      ts.isClassExpression(node.parent)
    ) {
      return defineSymbol(node.parent, checker);
    }

    return followSymbol(directTypeAndSymbol(node, checker), checker);
  }
}

function defineVariableDeclaration(node: ts.Node, checker: ts.TypeChecker) {
  if (ts.isVariableDeclaration(node)) {
    return directTypeAndSymbol(node.name, checker);
  }
}

function handleIdentifierInCall(node: ts.Node, checker: ts.TypeChecker) {
  if (
    (ts.isIdentifier(node) ||
      ts.isObjectLiteralExpression(node) ||
      ts.isArrayLiteralExpression(node)) &&
    (ts.isCallExpression(node.parent) || ts.isNewExpression(node.parent))
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

function defineProperties(node: ts.Node, checker: ts.TypeChecker) {
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
      return defineSymbol(typeDeclaration, checker);
    }

    return type;
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
      ? bindingPattern.elements.indexOf(node) + ""
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
    if (ts.isVariableDeclaration(node.parent) || ts.isParameter(node.parent)) {
      return defineSymbol(node.parent, checker);
    }

    invariantNode(node.parent);
  }
}

function defineTaggedTemplate(node: ts.Node, checker: ts.TypeChecker) {
  if (ts.isTaggedTemplateExpression(node)) {
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
