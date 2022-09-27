import ts from "typescript";
import { checkerEval, nodeEvalHandler, noType } from "./handlers";

export const classOperators = nodeEvalHandler(() => ({
  [ts.SyntaxKind.OverrideKeyword]: noType,
  [ts.SyntaxKind.SuperKeyword]: checkerEval,
  [ts.SyntaxKind.ThisKeyword]: checkerEval,

  [ts.SyntaxKind.HeritageClause]: checkerEval, // extends/implements
  [ts.SyntaxKind.ExpressionWithTypeArguments]: checkerEval,

  [ts.SyntaxKind.PrivateIdentifier]: checkerEval,

  [ts.SyntaxKind.ClassExpression]: checkerEval,
  [ts.SyntaxKind.ClassDeclaration]: checkerEval,
  [ts.SyntaxKind.Constructor]: checkerEval,
  [ts.SyntaxKind.PropertyDeclaration]: checkerEval,
  [ts.SyntaxKind.ClassStaticBlockDeclaration]: noType,

  // TODO: Consider narrowing from return values?
  [ts.SyntaxKind.MethodDeclaration]: checkerEval,
  [ts.SyntaxKind.GetAccessor]: checkerEval,
  [ts.SyntaxKind.SetAccessor]: checkerEval,

  [ts.SyntaxKind.SemicolonClassElement]: noType,

  [ts.SyntaxKind.EnumDeclaration]: checkerEval,
  [ts.SyntaxKind.EnumMember]: checkerEval,

  // Type
  [ts.SyntaxKind.PropertySignature]: checkerEval,
}));
