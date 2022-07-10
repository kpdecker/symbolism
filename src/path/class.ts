import ts from "typescript";
import { nameWithParent, nopPath, pathHandler, skipNode } from "./handlers";

export const classOperators = pathHandler({
  [ts.SyntaxKind.OverrideKeyword]: skipNode,
  [ts.SyntaxKind.SuperKeyword]: nameWithParent,
  [ts.SyntaxKind.ThisKeyword]: nameWithParent,

  [ts.SyntaxKind.HeritageClause]: nopPath, // extends/implements
  [ts.SyntaxKind.ExpressionWithTypeArguments]: skipNode,

  [ts.SyntaxKind.PrivateIdentifier]: nameWithParent,

  [ts.SyntaxKind.ClassExpression]: skipNode,
  [ts.SyntaxKind.ClassDeclaration]: nameWithParent,
  [ts.SyntaxKind.Constructor]({ getParentPath }) {
    return getParentPath() + "()";
  },
  [ts.SyntaxKind.MethodDeclaration]: nameWithParent,
  [ts.SyntaxKind.PropertyDeclaration]: nameWithParent,
  [ts.SyntaxKind.ClassStaticBlockDeclaration]: ({ getParentPath }) =>
    getParentPath() + ".static",

  [ts.SyntaxKind.GetAccessor]: nameWithParent,
  [ts.SyntaxKind.SetAccessor]: nameWithParent,

  [ts.SyntaxKind.SemicolonClassElement]: nopPath,

  // Type
  [ts.SyntaxKind.PropertySignature]: nameWithParent,
});
