import ts from "typescript";

import { defineSymbol } from "@symbolism/definitions";
import {
  getSymbolDeclaration,
  invariantNode,
  isIntrinsicType,
} from "@symbolism/ts-utils";
import { logDebug, NodeError } from "@symbolism/utils";
import { dumpNode } from "@symbolism/ts-debug";
import { AnySchemaNode } from "../schema";
import { SchemaContext } from "../context";
import { convertBinaryExpression } from "./binary-expression";
import { objectOperators } from "./object";
import { templateOperators } from "./string-template";
import { arrayOperators, convertArrayLiteralValue } from "./array";
import { isConcreteSchema } from "../classify";

import { checkerEval, NodeEvalHandler, noType, variableLike } from "./handlers";
import { classOperators } from "./class";
import { functionOperators } from "./function";
import { jsDocHandlers } from "./jsdoc";
import { jsxPathHandlers } from "./jsx";
import { tokenOperators } from "./tokens";
import { getLocalSymbol } from "./symbol";
import { getTypeSchema } from "../type-eval";
import { booleanPrimitiveSchema } from "../well-known-schemas";
import { createUnionKind } from "./union";
import invariant from "tiny-invariant";
import { unaryExpressionOperators } from "./unary-expression";

export type TypeEvalOptions = {
  allowMissing?: boolean;
  /**
   * Partially evaluates the schema, not tracing the entire tree
   * for type definitions.
   *
   * This is useful for finding
   */
  limitToValues?: boolean;
};

const nodePathHandlers: Record<ts.SyntaxKind, NodeEvalHandler> = {
  [ts.SyntaxKind.SourceFile]: noType,

  // Low level tokens
  ...tokenOperators,

  // Intrinsic Values
  [ts.SyntaxKind.AnyKeyword]: checkerEval,
  [ts.SyntaxKind.BigIntKeyword]: checkerEval,
  [ts.SyntaxKind.BigIntLiteral]: checkerEval,
  [ts.SyntaxKind.BooleanKeyword]: checkerEval,
  [ts.SyntaxKind.FalseKeyword]: checkerEval,
  [ts.SyntaxKind.NeverKeyword]: checkerEval,
  [ts.SyntaxKind.NullKeyword]: checkerEval,
  [ts.SyntaxKind.NumberKeyword]: checkerEval,
  [ts.SyntaxKind.NumericLiteral]: checkerEval,
  [ts.SyntaxKind.ObjectKeyword]: checkerEval,
  [ts.SyntaxKind.RegularExpressionLiteral]: checkerEval,
  [ts.SyntaxKind.StringKeyword]: checkerEval,
  [ts.SyntaxKind.StringLiteral]: checkerEval,
  [ts.SyntaxKind.SymbolKeyword]: checkerEval,
  [ts.SyntaxKind.TrueKeyword]: checkerEval,
  [ts.SyntaxKind.UndefinedKeyword]: checkerEval,
  [ts.SyntaxKind.UniqueKeyword]: checkerEval,
  [ts.SyntaxKind.Unknown]: checkerEval,
  [ts.SyntaxKind.UnknownKeyword]: checkerEval,
  [ts.SyntaxKind.VoidExpression]: checkerEval,
  [ts.SyntaxKind.VoidKeyword]: checkerEval,

  // References
  [ts.SyntaxKind.Identifier](node, context) {
    invariantNode(node, context.checker, ts.isIdentifier);
    const { checker } = context;

    if (context.options.limitToValues) {
      const localSymbol = getLocalSymbol(node, context.checker);
      const localDeclaration = getSymbolDeclaration(localSymbol);
      if (localDeclaration) {
        return getNodeSchema(localDeclaration, context);
      }
    }

    if (ts.isBindingElement(node.parent)) {
      return getNodeSchema(node.parent, context);
    }

    const identifierDefinition = defineSymbol(node, checker, {
      chooseLocal: false,
    });

    if (isIntrinsicType(identifierDefinition?.type)) {
      const { type } = identifierDefinition!;
      if (type?.flags! & ts.TypeFlags.Undefined) {
        return {
          kind: "literal",
          value: undefined,
        };
      } else if (type?.flags! & ts.TypeFlags.Null) {
        return {
          kind: "literal",
          value: null,
        };
      }
    }

    if (!context.options.limitToValues) {
      const identifierDeclaration = getSymbolDeclaration(
        identifierDefinition?.symbol
      );

      if (identifierDeclaration) {
        const type = context.checker.getTypeAtLocation(node);
        const declarationType = context.checker.getTypeAtLocation(
          identifierDeclaration
        );

        // Use the checker definition when we have type parameters involved.
        // TODO: Figure out what happens if this reference has a nested type param
        if (declarationType.isTypeParameter()) {
          return getTypeSchema(
            ...context.clone({
              type,
              node,
              decrementDepth: false,
            })
          );
        }

        return getNodeSchema(
          ...context.cloneNode({
            node: identifierDeclaration,
            decrementDepth: false,
          })
        );
      }
    }

    return {
      kind: "primitive",
      name: "any",
      node,
    };
  },
  [ts.SyntaxKind.QualifiedName]: checkerEval,

  // Expressions
  [ts.SyntaxKind.ParenthesizedExpression](node, context) {
    invariantNode(node, context.checker, ts.isParenthesizedExpression);
    return getNodeSchema(
      ...context.cloneNode({
        node: node.expression,
        decrementDepth: false,
      })
    );
  },
  [ts.SyntaxKind.DeleteExpression]() {
    return booleanPrimitiveSchema;
  },
  [ts.SyntaxKind.BinaryExpression]: convertBinaryExpression,
  [ts.SyntaxKind.ConditionalExpression](
    node,
    context
  ): AnySchemaNode | undefined {
    invariantNode(node, context.checker, ts.isConditionalExpression);
    const conditionSchema = getNodeSchema(
      ...context.cloneNode({
        node: node.condition,
        decrementDepth: false,
      })
    );
    const trueSchema = getNodeSchema(
      ...context.cloneNode({
        node: node.whenTrue,
        decrementDepth: false,
        allowMissing: false,
      })
    )!;
    const falseSchema = getNodeSchema(
      ...context.cloneNode({
        node: node.whenFalse,
        decrementDepth: false,
        allowMissing: false,
      })
    )!;

    if (isConcreteSchema(conditionSchema)) {
      if (conditionSchema?.kind === "literal") {
        if (conditionSchema.value) {
          return trueSchema;
        } else {
          return falseSchema;
        }
      }
    }

    return createUnionKind([trueSchema, falseSchema]);
  },
  [ts.SyntaxKind.OmittedExpression]: noType,
  [ts.SyntaxKind.AsExpression]: checkerEval,
  [ts.SyntaxKind.TypeAssertionExpression]: checkerEval,
  [ts.SyntaxKind.CommaListExpression](node, context) {
    invariantNode(node, context.checker, ts.isCommaListExpression);
    return getNodeSchema(
      ...context.cloneNode({
        node: node.elements[node.elements.length - 1],
        decrementDepth: false,
      })
    );
  },

  // Statements
  [ts.SyntaxKind.ExpressionStatement]: noType,
  [ts.SyntaxKind.EmptyStatement]: noType,
  [ts.SyntaxKind.VariableStatement]: noType,
  [ts.SyntaxKind.IfStatement]: noType,
  [ts.SyntaxKind.DoStatement]: noType,
  [ts.SyntaxKind.WhileStatement]: noType,
  [ts.SyntaxKind.ForStatement]: noType,
  [ts.SyntaxKind.ForInStatement]: noType,
  [ts.SyntaxKind.ForOfStatement]: noType,
  [ts.SyntaxKind.LabeledStatement]: noType,
  [ts.SyntaxKind.ContinueStatement]: noType,
  [ts.SyntaxKind.BreakStatement]: noType,
  [ts.SyntaxKind.WithStatement]: noType,
  [ts.SyntaxKind.TryStatement]: noType,
  [ts.SyntaxKind.CatchClause]: noType,
  [ts.SyntaxKind.DebuggerStatement]: noType,

  [ts.SyntaxKind.SwitchStatement]: noType,
  [ts.SyntaxKind.CaseClause]: noType,
  [ts.SyntaxKind.DefaultClause]: noType,
  [ts.SyntaxKind.CaseBlock]: noType,

  // Declarations
  [ts.SyntaxKind.Decorator]: noType,

  [ts.SyntaxKind.ObjectBindingPattern](node, context) {
    invariantNode(node, context.checker, ts.isObjectBindingPattern);
    return getNodeSchema(
      ...context.cloneNode({
        node: node.parent,
        decrementDepth: false,
      })
    );
  },
  [ts.SyntaxKind.BindingElement]: variableLike,

  [ts.SyntaxKind.VariableDeclaration]: variableLike,
  [ts.SyntaxKind.VariableDeclarationList]: noType,

  [ts.SyntaxKind.SyntaxList]: noType,

  // Type Declarations
  [ts.SyntaxKind.ConstructSignature]: checkerEval,
  [ts.SyntaxKind.IndexSignature]: checkerEval,
  [ts.SyntaxKind.TypePredicate]: checkerEval,
  [ts.SyntaxKind.TypeReference]: checkerEval,
  [ts.SyntaxKind.FunctionType]: checkerEval,
  [ts.SyntaxKind.ConstructorType]: checkerEval,
  [ts.SyntaxKind.TypeQuery]: checkerEval,
  [ts.SyntaxKind.TypeLiteral]: checkerEval,
  [ts.SyntaxKind.ArrayType]: checkerEval,
  [ts.SyntaxKind.TupleType]: checkerEval,
  [ts.SyntaxKind.OptionalType]: checkerEval,
  [ts.SyntaxKind.RestType]: checkerEval,
  [ts.SyntaxKind.UnionType]: checkerEval,
  [ts.SyntaxKind.IntersectionType]: checkerEval,
  [ts.SyntaxKind.ConditionalType]: checkerEval,
  [ts.SyntaxKind.InferType]: checkerEval,
  [ts.SyntaxKind.ParenthesizedType]: checkerEval,
  [ts.SyntaxKind.ThisType]: checkerEval,
  [ts.SyntaxKind.TypeOperator]: checkerEval,
  [ts.SyntaxKind.IndexedAccessType]: checkerEval,
  [ts.SyntaxKind.MappedType]: checkerEval,
  [ts.SyntaxKind.LiteralType]: checkerEval,
  [ts.SyntaxKind.NamedTupleMember]: checkerEval,
  [ts.SyntaxKind.InterfaceDeclaration]: checkerEval,
  [ts.SyntaxKind.TypeAliasDeclaration](node, context) {
    invariantNode(node, context.checker, ts.isTypeAliasDeclaration);

    const typeDefinition = defineSymbol(node.type, context.checker, {
      chooseLocal: false,
    });
    const typeDeclaration = getSymbolDeclaration(typeDefinition?.symbol);

    // If we have an alias symbol, resolve the type from that as it has type
    // parameters evaluated.
    if (typeDefinition?.type?.aliasSymbol) {
      return getTypeSchema(
        ...context.clone({
          type: typeDefinition.type,
          node: typeDeclaration,
          decrementDepth: false,
        })
      );
    }

    if (typeDeclaration) {
      return getNodeSchema(
        ...context.cloneNode({
          node: typeDeclaration,
          decrementDepth: false,
        })
      );
    }

    return checkerEval(node, context);
  },
  [ts.SyntaxKind.ModuleDeclaration]: checkerEval,
  [ts.SyntaxKind.ModuleBlock]: checkerEval,
  [ts.SyntaxKind.TypeOfExpression]: checkerEval,
  [ts.SyntaxKind.CallSignature]: checkerEval,
  [ts.SyntaxKind.MethodSignature]: checkerEval,
  [ts.SyntaxKind.TypeParameter]: checkerEval,

  // Import/Export
  [ts.SyntaxKind.ImportType]: checkerEval,
  [ts.SyntaxKind.NamespaceExportDeclaration]: checkerEval,
  [ts.SyntaxKind.ImportEqualsDeclaration]: checkerEval,
  [ts.SyntaxKind.ImportDeclaration]: checkerEval,
  [ts.SyntaxKind.ImportClause]: checkerEval,
  [ts.SyntaxKind.NamespaceImport]: checkerEval,
  [ts.SyntaxKind.NamedImports]: checkerEval,
  [ts.SyntaxKind.ImportSpecifier]: checkerEval,
  [ts.SyntaxKind.ExportAssignment]: checkerEval,
  [ts.SyntaxKind.ExportDeclaration]: checkerEval,
  [ts.SyntaxKind.NamedExports]: checkerEval,
  [ts.SyntaxKind.NamespaceExport]: checkerEval,
  [ts.SyntaxKind.ExportSpecifier]: checkerEval,
  [ts.SyntaxKind.ExternalModuleReference]: checkerEval,
  [ts.SyntaxKind.ImportTypeAssertionContainer]: checkerEval,
  [ts.SyntaxKind.AssertClause]: noType,
  [ts.SyntaxKind.AssertEntry]: noType,
  [ts.SyntaxKind.MetaProperty]: noType, // import.foo

  // Error Constructs
  [ts.SyntaxKind.MissingDeclaration]: noType,
  [ts.SyntaxKind.UnparsedPrologue]: noType,
  [ts.SyntaxKind.UnparsedPrepend]: noType,
  [ts.SyntaxKind.UnparsedText]: noType,
  [ts.SyntaxKind.UnparsedInternalText]: noType,
  [ts.SyntaxKind.UnparsedSyntheticReference]: noType,

  // Not Printed Constructs
  [ts.SyntaxKind.Bundle]: noType,
  [ts.SyntaxKind.UnparsedSource]: noType,
  [ts.SyntaxKind.InputFiles]: noType,
  [ts.SyntaxKind.NotEmittedStatement]: noType,
  [ts.SyntaxKind.PartiallyEmittedExpression]: noType,
  [ts.SyntaxKind.SyntheticExpression]: noType,
  [ts.SyntaxKind.SyntheticReferenceExpression]: noType,
  [ts.SyntaxKind.Count]: noType,

  // Misc
  [ts.SyntaxKind.MergeDeclarationMarker]: noType,
  [ts.SyntaxKind.EndOfDeclarationMarker]: noType,

  ...unaryExpressionOperators,
  ...templateOperators,
  ...objectOperators,
  ...arrayOperators,
  ...functionOperators,
  ...classOperators,
  ...jsDocHandlers,
  ...jsxPathHandlers,
};

export function getNodeSchema(
  node: ts.Node,
  context: SchemaContext
): AnySchemaNode | undefined {
  if (context.maxDepth <= 0) {
    return {
      kind: "reference",
      name: "tooMuchRecursion",
      parameters: [],
      typeName: "tooMuchRecursion",
    };
  }

  logDebug("getNodeSchema", dumpNode(node, context.checker));
  try {
    const handler = nodePathHandlers[node.kind];
    invariant(
      handler,
      "No handler for node kind: " +
        JSON.stringify(dumpNode(node, context.checker))
    );
    const ret = handler(node, context);
    if (ret) {
      return ret;
    }

    if (!context.options.allowMissing) {
      throw new NodeError(
        `Unsupported expression: ${ts.SyntaxKind[node.kind]}`,
        node,
        context.checker
      );
    } else {
      logDebug(
        `Unsupported expression: ${
          ts.SyntaxKind[node.kind]
        }\n\nNode: ${JSON.stringify(dumpNode(node, context.checker))}`
      );
    }
  } catch (err) {
    throw new NodeError(
      "Error resolving node schema",
      node,
      context.checker,
      err as Error
    );
  }
}

function dontNarrow(node: ts.Node): boolean {
  return (
    ts.isCallExpression(node) ||
    ts.isVariableDeclaration(node) ||
    ts.isFunctionLike(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isJsxAttributes(node) ||
    ts.isParameter(node) ||
    ts.isMethodSignature(node) ||
    ts.isPropertySignature(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isIndexSignatureDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isTypeParameterDeclaration(node) ||
    ts.isTypeNode(node)
  );
}

export function narrowTypeFromValues(
  type: ts.Type,
  context: SchemaContext
): AnySchemaNode | undefined {
  const { contextNode, checker } = context;

  const symbol = type.getSymbol();
  const symbolDeclaration = getSymbolDeclaration(symbol);

  // No narrowing to be done on type nodes, just use the checker evaluation.
  if (
    (symbolDeclaration && dontNarrow(symbolDeclaration)) ||
    dontNarrow(contextNode)
  ) {
    return undefined;
  }

  if (context.narrowingNode === contextNode) {
    throw new NodeError(
      "Circular narrowing node " + checker.typeToString(type),
      contextNode,
      checker
    );
    return undefined;
  }

  // Create a new context to create a new circular reference check scope.
  // This allows for independent resolution of these distinct types. The
  // narrowingNode check ensures that we don't infinitely recurse.
  const newContext = new SchemaContext(
    contextNode,
    context.checker,
    context.options
  );
  newContext.narrowingNode = contextNode;

  if (symbolDeclaration) {
    const symbolSchema = getNodeSchema(
      ...newContext.cloneNode({
        node: symbolDeclaration,
        decrementDepth: false,
        allowMissing: true,
      })
    );
    if (symbolSchema) {
      return symbolSchema;
    }
  }

  if (contextNode) {
    // If we are using the context node, we will need to resolve where it lives.
    const contextDefinition = defineSymbol(contextNode, checker, {
      chooseLocal: false,
    });
    if (
      contextDefinition?.declaration &&
      contextDefinition.declaration !== symbolDeclaration
    ) {
      const contextSchema = getNodeSchema(
        ...newContext.cloneNode({
          node: contextDefinition.declaration,
          decrementDepth: false,
          allowMissing: true,
        })
      );
      if (contextSchema) {
        return contextSchema;
      }
    }

    const contextSchema = getNodeSchema(
      ...newContext.cloneNode({
        node: contextNode as ts.Expression,
        decrementDepth: false,
        allowMissing: true,
      })
    );
    if (contextSchema) {
      return contextSchema;
    }
  }
}
