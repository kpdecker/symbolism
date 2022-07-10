import ts from "typescript";
import {
  literalText,
  nameWithParent,
  nopPath,
  PathHandler,
  skipNode,
} from "./handlers";
import { classOperators } from "./class";
import { functionOperators } from "./function";
import { jsDocHandlers } from "./jsdoc";
import { jsxPathHandlers } from "./jsx";
import { tokenOperators } from "./tokens";
import { invariantNode, isNamedDeclaration } from "../definition-symbol/utils";

const handlePropertyAccess: PathHandler = ({ node, getParentPath }) => {
  invariantNode(
    node,
    (node): node is ts.PropertyAccessExpression | ts.ElementAccessExpression =>
      ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)
  );

  function resolvePropertyAccessDownward(node: ts.Node): string {
    if (ts.isIdentifier(node)) {
      return node.getText();
    } else if (ts.isPropertyAccessExpression(node)) {
      return (
        resolvePropertyAccessDownward(node.expression) +
        "." +
        node.name.getText()
      );
    } else if (ts.isElementAccessExpression(node)) {
      return (
        resolvePropertyAccessDownward(node.expression) +
        "." +
        node.argumentExpression.getText()
      );
    }
    throw new Error("Unexpected node type");
  }

  return getParentPath() + "." + resolvePropertyAccessDownward(node);
};

const nodePathHandlers: Record<ts.SyntaxKind, PathHandler> = {
  [ts.SyntaxKind.SourceFile]: nopPath,

  // Low level tokens
  ...tokenOperators,

  // Intrinsic Values
  [ts.SyntaxKind.NullKeyword]: literalText,
  [ts.SyntaxKind.NumericLiteral]: literalText,
  [ts.SyntaxKind.Unknown]: literalText,
  [ts.SyntaxKind.BigIntLiteral]: literalText,
  [ts.SyntaxKind.StringLiteral]: literalText,
  [ts.SyntaxKind.RegularExpressionLiteral]: literalText,
  [ts.SyntaxKind.NoSubstitutionTemplateLiteral]: literalText,
  [ts.SyntaxKind.TrueKeyword]: literalText,
  [ts.SyntaxKind.FalseKeyword]: literalText,
  [ts.SyntaxKind.NullKeyword]: literalText,
  [ts.SyntaxKind.VoidExpression]: literalText,

  // References
  [ts.SyntaxKind.Identifier](context) {
    const { node, getParentPath } = context;
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
      return getParentPath();
    }
    return getParentPath() + "." + node.getText();
  },
  [ts.SyntaxKind.QualifiedName]: nameWithParent,

  // Expressions
  [ts.SyntaxKind.ArrayLiteralExpression]: skipNode,
  [ts.SyntaxKind.SpreadElement]: skipNode,
  [ts.SyntaxKind.ObjectLiteralExpression]: skipNode,
  [ts.SyntaxKind.PropertyAssignment]: nameWithParent,
  [ts.SyntaxKind.ShorthandPropertyAssignment]: nameWithParent,
  [ts.SyntaxKind.SpreadAssignment]: nopPath,
  [ts.SyntaxKind.ComputedPropertyName]: nopPath,

  [ts.SyntaxKind.PropertyAccessExpression]: handlePropertyAccess,
  [ts.SyntaxKind.ElementAccessExpression]: handlePropertyAccess,
  [ts.SyntaxKind.ParenthesizedExpression]: skipNode,
  [ts.SyntaxKind.DeleteExpression]: skipNode,
  [ts.SyntaxKind.AwaitExpression]: skipNode,
  [ts.SyntaxKind.PrefixUnaryExpression]: skipNode,
  [ts.SyntaxKind.PostfixUnaryExpression]: skipNode,
  [ts.SyntaxKind.BinaryExpression]: skipNode,
  [ts.SyntaxKind.ConditionalExpression]: skipNode,
  [ts.SyntaxKind.TemplateExpression]: skipNode,
  [ts.SyntaxKind.OmittedExpression]: nopPath,
  [ts.SyntaxKind.AsExpression]: skipNode,
  [ts.SyntaxKind.TypeAssertionExpression]: skipNode,
  [ts.SyntaxKind.NonNullExpression]: skipNode,
  [ts.SyntaxKind.CommaListExpression]: skipNode,

  [ts.SyntaxKind.TaggedTemplateExpression]: skipNode,
  [ts.SyntaxKind.TemplateHead]: skipNode,
  [ts.SyntaxKind.TemplateMiddle]: skipNode,
  [ts.SyntaxKind.TemplateTail]: skipNode,
  [ts.SyntaxKind.TemplateSpan]: skipNode,

  // Statements
  [ts.SyntaxKind.ExpressionStatement]: skipNode,
  [ts.SyntaxKind.EmptyStatement]: skipNode,
  [ts.SyntaxKind.VariableStatement]: skipNode,
  [ts.SyntaxKind.IfStatement]: skipNode,
  [ts.SyntaxKind.DoStatement]: skipNode,
  [ts.SyntaxKind.WhileStatement]: skipNode,
  [ts.SyntaxKind.ForStatement]: skipNode,
  [ts.SyntaxKind.ForInStatement]: skipNode,
  [ts.SyntaxKind.ForOfStatement]: skipNode,
  [ts.SyntaxKind.LabeledStatement]: skipNode,
  [ts.SyntaxKind.ThrowStatement]: skipNode,
  [ts.SyntaxKind.ContinueStatement]: skipNode,
  [ts.SyntaxKind.BreakStatement]: skipNode,
  [ts.SyntaxKind.WithStatement]: skipNode,
  [ts.SyntaxKind.TryStatement]: skipNode,
  [ts.SyntaxKind.CatchClause]: skipNode,
  [ts.SyntaxKind.DebuggerStatement]: skipNode,

  [ts.SyntaxKind.SwitchStatement]: skipNode,
  [ts.SyntaxKind.CaseClause]: skipNode,
  [ts.SyntaxKind.DefaultClause]: skipNode,
  [ts.SyntaxKind.CaseBlock]: skipNode,

  // Declarations
  [ts.SyntaxKind.Decorator]: nameWithParent,

  [ts.SyntaxKind.ObjectBindingPattern]: skipNode,
  [ts.SyntaxKind.ArrayBindingPattern]: skipNode,
  [ts.SyntaxKind.BindingElement]: skipNode,

  [ts.SyntaxKind.VariableDeclaration]: nameWithParent,
  [ts.SyntaxKind.VariableDeclarationList]: skipNode,

  [ts.SyntaxKind.EnumDeclaration]: nameWithParent,
  [ts.SyntaxKind.EnumMember]: nameWithParent,
  [ts.SyntaxKind.SyntaxList]: skipNode,

  // Type Declarations
  [ts.SyntaxKind.ConstructSignature]: nameWithParent,
  [ts.SyntaxKind.IndexSignature]: nameWithParent,
  [ts.SyntaxKind.TypePredicate]: nameWithParent,
  [ts.SyntaxKind.TypeReference]: nameWithParent,
  [ts.SyntaxKind.FunctionType]: nameWithParent,
  [ts.SyntaxKind.ConstructorType]: nameWithParent,
  [ts.SyntaxKind.TypeQuery]: skipNode,
  [ts.SyntaxKind.TypeLiteral]: skipNode,
  [ts.SyntaxKind.ArrayType]: skipNode,
  [ts.SyntaxKind.TupleType]: nameWithParent,
  [ts.SyntaxKind.OptionalType]: nameWithParent,
  [ts.SyntaxKind.RestType]: nameWithParent,
  [ts.SyntaxKind.UnionType]: nameWithParent,
  [ts.SyntaxKind.IntersectionType]: nameWithParent,
  [ts.SyntaxKind.ConditionalType]: nameWithParent,
  [ts.SyntaxKind.InferType]: nameWithParent,
  [ts.SyntaxKind.ParenthesizedType]: skipNode,
  [ts.SyntaxKind.ThisType]: nameWithParent,
  [ts.SyntaxKind.TypeOperator]: nameWithParent,
  [ts.SyntaxKind.IndexedAccessType]: nameWithParent,
  [ts.SyntaxKind.MappedType]: nameWithParent,
  [ts.SyntaxKind.LiteralType]: literalText,
  [ts.SyntaxKind.NamedTupleMember]: nameWithParent,
  [ts.SyntaxKind.TemplateLiteralType]: nameWithParent,
  [ts.SyntaxKind.TemplateLiteralTypeSpan]: nameWithParent,
  [ts.SyntaxKind.InterfaceDeclaration]: nameWithParent,
  [ts.SyntaxKind.TypeAliasDeclaration]: nameWithParent,
  [ts.SyntaxKind.ModuleDeclaration]: nameWithParent,
  [ts.SyntaxKind.ModuleBlock]: skipNode,
  [ts.SyntaxKind.TypeOfExpression]: nameWithParent,
  [ts.SyntaxKind.CallSignature]: nameWithParent,
  [ts.SyntaxKind.MethodSignature]: nameWithParent,
  [ts.SyntaxKind.TypeParameter]: nameWithParent,

  // Import/Export
  [ts.SyntaxKind.ImportType]: nameWithParent,
  [ts.SyntaxKind.NamespaceExportDeclaration]: nameWithParent,
  [ts.SyntaxKind.ImportEqualsDeclaration]: nameWithParent,
  [ts.SyntaxKind.ImportDeclaration]: nameWithParent,
  [ts.SyntaxKind.ImportClause]: nameWithParent,
  [ts.SyntaxKind.NamespaceImport]: nameWithParent,
  [ts.SyntaxKind.NamedImports]: nameWithParent,
  [ts.SyntaxKind.ImportSpecifier]: nameWithParent,
  [ts.SyntaxKind.ExportAssignment]: nameWithParent,
  [ts.SyntaxKind.ExportDeclaration]: nameWithParent,
  [ts.SyntaxKind.NamedExports]: nameWithParent,
  [ts.SyntaxKind.NamespaceExport]: nameWithParent,
  [ts.SyntaxKind.ExportSpecifier]: nameWithParent,
  [ts.SyntaxKind.ExternalModuleReference]: nameWithParent,
  [ts.SyntaxKind.ImportTypeAssertionContainer]: nameWithParent,
  [ts.SyntaxKind.AssertClause]: skipNode,
  [ts.SyntaxKind.AssertEntry]: skipNode,
  [ts.SyntaxKind.MetaProperty]: skipNode, // import.foo

  // Error Constructs
  [ts.SyntaxKind.MissingDeclaration]: skipNode,
  [ts.SyntaxKind.UnparsedPrologue]: skipNode,
  [ts.SyntaxKind.UnparsedPrepend]: skipNode,
  [ts.SyntaxKind.UnparsedText]: skipNode,
  [ts.SyntaxKind.UnparsedInternalText]: skipNode,
  [ts.SyntaxKind.UnparsedSyntheticReference]: skipNode,

  // Not Printed Constructs
  [ts.SyntaxKind.Bundle]: skipNode,
  [ts.SyntaxKind.UnparsedSource]: skipNode,
  [ts.SyntaxKind.InputFiles]: skipNode,
  [ts.SyntaxKind.NotEmittedStatement]: skipNode,
  [ts.SyntaxKind.PartiallyEmittedExpression]: skipNode,
  [ts.SyntaxKind.SyntheticExpression]: skipNode,
  [ts.SyntaxKind.SyntheticReferenceExpression]: skipNode,
  [ts.SyntaxKind.Count]: skipNode,

  // Misc
  [ts.SyntaxKind.MergeDeclarationMarker]: skipNode,
  [ts.SyntaxKind.EndOfDeclarationMarker]: skipNode,

  ...functionOperators,
  ...classOperators,
  ...jsDocHandlers,
  ...jsxPathHandlers,
};

export function namedPathToNode(
  node: ts.Node,
  checker: ts.TypeChecker,
  filter: (node: ts.Node) => boolean = (node) => !!node,
  child?: ts.Node
): string {
  function getPath(child: ts.Node) {
    return namedPathToNode(child, checker, filter).replace(/^\./, "");
  }
  function getParentPath() {
    return getPath(node.parent);
  }

  // Use the symbol definition when possible.
  const symbol = checker.getSymbolAtLocation(node);
  const symbolDeclaration = symbol?.declarations?.[0];
  if (symbolDeclaration) {
    node = symbolDeclaration;
  }

  // console.log("path!", ts.SyntaxKind[node.kind]);
  const ret = nodePathHandlers[node.kind]({
    node,
    checker,
    getPath,
    getParentPath,
  });
  return ret.replace(/^\./, "");
}
