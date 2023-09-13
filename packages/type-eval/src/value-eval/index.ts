import ts from "typescript";

import { defineSymbol } from "@noom/symbolism-definitions";
import {
  getSymbolDeclaration,
  invariantNode,
  isIntrinsicType,
} from "@noom/symbolism-ts-utils";
import { assertExists, logDebug, NodeError } from "@noom/symbolism-utils";
import { dumpNode } from "@noom/symbolism-ts-debug";
import { AnySchemaNode } from "../schema";
import { SchemaContext } from "../context";
import { convertBinaryExpression } from "./binary-expression";
import { objectOperators } from "./object";
import { templateOperators } from "./string-template";
import { arrayOperators } from "./array";
import { isConcreteSchema } from "../classify";

import {
  checkerEval,
  NodeEvalHandler,
  noType,
  remapSchemaNode,
  variableLike,
} from "./handlers";
import { classOperators } from "./class";
import { functionOperators } from "./function";
import { jsDocHandlers } from "./jsdoc";
import { jsxPathHandlers } from "./jsx";
import { tokenOperators } from "./tokens";
import { getTypeSchema } from "../type-eval";
import {
  booleanPrimitiveSchema,
  tooMuchRecursionSchema,
} from "../well-known-schemas";
import { createUnionKind } from "./union";
import invariant from "tiny-invariant";
import { unaryExpressionOperators } from "./unary-expression";

export type TypeEvalOptions = {
  allowMissing?: boolean;

  /**
   * True to evaluate parameters. Otherwise parameters will be mapped to unknown schema.
   * Most use cases for function schema don't require knowledge of the evaled parameter
   * type and calculating this can be expensive, so this flag makes that opt in.
   */
  evalParameters?: boolean;

  /**
   * If true, will not attempt to resolve the final type of parameter nodes,
   * instead mapping them to any type with the correct replacement node.
   */
  lateBindParameters?: boolean;
};

const nodePathHandlers: Record<ts.SyntaxKind, NodeEvalHandler> = {
  [ts.SyntaxKind.SourceFile]: noType,

  // Low level tokens
  ...tokenOperators(),

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

    if (ts.isParameter(node.parent)) {
      return getNodeSchema({
        node: node.parent,
        context,
        decrementDepth: false,
      });
    }

    if (
      ts.isBindingElement(node.parent) ||
      ((ts.isPropertyAccessExpression(node.parent) ||
        ts.isPropertyAssignment(node.parent)) &&
        node.parent.name === node)
    ) {
      return remapSchemaNode(
        getNodeSchema({
          node: node.parent,
          context,
          decrementDepth: false,
        }),
        node
      );
    }

    const identifierDefinition = defineSymbol(node, checker, {
      chooseLocal: !!context.options.lateBindParameters,
    });
    const identifierType = identifierDefinition?.getType();

    if (isIntrinsicType(identifierType)) {
      if (assertExists(identifierType?.flags) & ts.TypeFlags.Undefined) {
        return {
          kind: "literal",
          value: undefined,
        };
      } else if (assertExists(identifierType?.flags) & ts.TypeFlags.Null) {
        return {
          kind: "literal",
          value: null,
        };
      }
    }

    const identifierDeclaration = getSymbolDeclaration(
      identifierDefinition?.symbol
    );

    if (identifierDeclaration) {
      const type = context.checker.getTypeAtLocation(node);
      const declarationType = context.checker.getTypeAtLocation(
        identifierDeclaration
      );

      // Use the checker definition when we have type parameters involved.p
      // TODO: Figure out what happens if this reference has a nested type param
      if (declarationType.isTypeParameter()) {
        return getTypeSchema({
          context,
          type,
          node,
          decrementDepth: false,
        });
      }

      return remapSchemaNode(
        getNodeSchema({
          context,
          node: identifierDeclaration,
          decrementDepth: false,
        }),
        node
      );
    }

    // We have a type, but no declaration. This is probably an index signature.
    const checkerType =
      identifierDefinition?.getType() || checker.getTypeAtLocation(node);
    return getTypeSchema({
      type: checkerType,
      node: node,
      decrementDepth: false,
      context,
    });
  },
  [ts.SyntaxKind.QualifiedName]: checkerEval,

  // Expressions
  [ts.SyntaxKind.ParenthesizedExpression](node, context) {
    invariantNode(node, context.checker, ts.isParenthesizedExpression);
    return getNodeSchema({
      context,
      node: node.expression,
      decrementDepth: false,
    });
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
    const conditionSchema = context.resolveSchema(
      getNodeSchema({
        context,
        node: node.condition,
        decrementDepth: false,
      })
    );
    const trueSchema = assertExists(
      getNodeSchema({
        context,
        node: node.whenTrue,
        decrementDepth: false,
        allowMissing: false,
      })
    );
    const falseSchema = assertExists(
      getNodeSchema({
        context,
        node: node.whenFalse,
        decrementDepth: false,
        allowMissing: false,
      })
    );

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
  [ts.SyntaxKind.NonNullExpression](node, context) {
    invariantNode(node, context.checker, ts.isNonNullExpression);
    const schema = getNodeSchema({
      context,
      node: node.expression,
      decrementDepth: false,
    });
    const dereferencedSchema = context.resolveSchema(schema);
    if (dereferencedSchema?.kind === "union") {
      return createUnionKind(
        dereferencedSchema.items.filter(
          (item) => item.kind !== "literal" || item.value != null
        )
      );
    }
    return schema;
  },
  [ts.SyntaxKind.CommaListExpression](node, context) {
    invariantNode(node, context.checker, ts.isCommaListExpression);
    return getNodeSchema({
      context,
      node: node.elements[node.elements.length - 1],
      decrementDepth: false,
    });
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
    return getNodeSchema({
      context,
      node: node.parent,
      decrementDepth: false,
    });
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
    if (typeDefinition?.getType()?.aliasSymbol) {
      return getTypeSchema({
        context,
        type: assertExists(typeDefinition.getType()),
        node: typeDeclaration,
        decrementDepth: false,
      });
    }

    if (typeDeclaration) {
      return getNodeSchema({
        context,
        node: typeDeclaration,
        decrementDepth: false,
      });
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

  ...unaryExpressionOperators(),
  ...templateOperators(),
  ...objectOperators(),
  ...arrayOperators(),
  ...functionOperators(),
  ...classOperators(),
  ...jsDocHandlers(),
  ...jsxPathHandlers(),
};

export function getNodeSchema(
  options: {
    node: ts.Node;
    decrementDepth: boolean;
    context: SchemaContext;
  } & TypeEvalOptions
): AnySchemaNode | undefined {
  const context = options.context.cloneNode(options);
  const { node } = options;

  if (ts.isParameter(node) && context.parameterBindings.has(node)) {
    return context.parameterBindings.get(node);
  }

  if (context.maxDepth <= 0) {
    return tooMuchRecursionSchema;
  }

  logDebug("getNodeSchema", () => dumpNode(node, context.checker));
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
        `Unsupported expression: ${ts.SyntaxKind[node.kind]} ${
          context.history
        }`,
        node,
        context.checker
      );
    } else {
      logDebug(
        () =>
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
