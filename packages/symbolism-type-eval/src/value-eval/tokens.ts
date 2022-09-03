import { getSymbolDeclaration } from "@symbolism/ts-utils";
import ts from "typescript";
import { getTypeSchema } from "../type-eval";
import { noType, nodeEvalHandler, checkerEval } from "./handlers";

export const tokenOperators = nodeEvalHandler(() => ({
  [ts.SyntaxKind.EndOfFileToken]: noType,
  [ts.SyntaxKind.SingleLineCommentTrivia]: noType,
  [ts.SyntaxKind.MultiLineCommentTrivia]: noType,
  [ts.SyntaxKind.NewLineTrivia]: noType,
  [ts.SyntaxKind.WhitespaceTrivia]: noType,
  [ts.SyntaxKind.ShebangTrivia]: noType,
  [ts.SyntaxKind.ConflictMarkerTrivia]: noType,
  [ts.SyntaxKind.OpenBraceToken]: noType,
  [ts.SyntaxKind.CloseBraceToken]: noType,
  [ts.SyntaxKind.OpenParenToken]: noType,
  [ts.SyntaxKind.CloseParenToken]: noType,
  [ts.SyntaxKind.OpenBracketToken]: noType,
  [ts.SyntaxKind.CloseBracketToken]: noType,
  [ts.SyntaxKind.DotToken]: noType,
  [ts.SyntaxKind.DotDotDotToken]: noType,
  [ts.SyntaxKind.SemicolonToken]: noType,
  [ts.SyntaxKind.CommaToken]: noType,
  [ts.SyntaxKind.QuestionDotToken]: noType,
  [ts.SyntaxKind.LessThanToken]: noType,
  [ts.SyntaxKind.LessThanSlashToken]: noType,
  [ts.SyntaxKind.GreaterThanToken]: noType,
  [ts.SyntaxKind.LessThanEqualsToken]: noType,
  [ts.SyntaxKind.GreaterThanEqualsToken]: noType,
  [ts.SyntaxKind.EqualsEqualsToken]: noType,
  [ts.SyntaxKind.ExclamationEqualsToken]: noType,
  [ts.SyntaxKind.EqualsEqualsEqualsToken]: noType,
  [ts.SyntaxKind.ExclamationEqualsEqualsToken]: noType,
  [ts.SyntaxKind.EqualsGreaterThanToken]: noType,
  [ts.SyntaxKind.PlusToken]: noType,
  [ts.SyntaxKind.MinusToken]: noType,
  [ts.SyntaxKind.AsteriskToken]: noType,
  [ts.SyntaxKind.AsteriskAsteriskToken]: noType,
  [ts.SyntaxKind.SlashToken]: noType,
  [ts.SyntaxKind.PercentToken]: noType,
  [ts.SyntaxKind.PlusPlusToken]: noType,
  [ts.SyntaxKind.MinusMinusToken]: noType,
  [ts.SyntaxKind.LessThanLessThanToken]: noType,
  [ts.SyntaxKind.GreaterThanGreaterThanToken]: noType,
  [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken]: noType,
  [ts.SyntaxKind.AmpersandToken]: noType,
  [ts.SyntaxKind.BarToken]: noType,
  [ts.SyntaxKind.CaretToken]: noType,
  [ts.SyntaxKind.ExclamationToken]: noType,
  [ts.SyntaxKind.TildeToken]: noType,
  [ts.SyntaxKind.AmpersandAmpersandToken]: noType,
  [ts.SyntaxKind.BarBarToken]: noType,
  [ts.SyntaxKind.QuestionToken]: noType,
  [ts.SyntaxKind.ColonToken]: noType,
  [ts.SyntaxKind.AtToken]: noType,
  [ts.SyntaxKind.QuestionQuestionToken]: noType,
  [ts.SyntaxKind.BacktickToken]: noType,
  [ts.SyntaxKind.HashToken]: noType,
  [ts.SyntaxKind.EqualsToken]: noType,
  [ts.SyntaxKind.PlusEqualsToken]: noType,
  [ts.SyntaxKind.MinusEqualsToken]: noType,
  [ts.SyntaxKind.AsteriskEqualsToken]: noType,
  [ts.SyntaxKind.AsteriskAsteriskEqualsToken]: noType,
  [ts.SyntaxKind.SlashEqualsToken]: noType,
  [ts.SyntaxKind.PercentEqualsToken]: noType,
  [ts.SyntaxKind.LessThanLessThanEqualsToken]: noType,
  [ts.SyntaxKind.GreaterThanGreaterThanEqualsToken]: noType,
  [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken]: noType,
  [ts.SyntaxKind.AmpersandEqualsToken]: noType,
  [ts.SyntaxKind.BarEqualsToken]: noType,
  [ts.SyntaxKind.BarBarEqualsToken]: noType,
  [ts.SyntaxKind.AmpersandAmpersandEqualsToken]: noType,
  [ts.SyntaxKind.QuestionQuestionEqualsToken]: noType,
  [ts.SyntaxKind.CaretEqualsToken]: noType,
  [ts.SyntaxKind.BreakKeyword]: noType,
  [ts.SyntaxKind.CaseKeyword]: noType,
  [ts.SyntaxKind.CatchKeyword]: noType,
  [ts.SyntaxKind.ClassKeyword]: noType,
  [ts.SyntaxKind.ConstKeyword]: noType,
  [ts.SyntaxKind.ContinueKeyword]: noType,
  [ts.SyntaxKind.DebuggerKeyword]: noType,
  [ts.SyntaxKind.DefaultKeyword]: noType,
  [ts.SyntaxKind.DeleteKeyword]: noType,
  [ts.SyntaxKind.DoKeyword]: noType,
  [ts.SyntaxKind.ElseKeyword]: noType,
  [ts.SyntaxKind.EnumKeyword]: noType,
  [ts.SyntaxKind.ExportKeyword]: noType,
  [ts.SyntaxKind.ExtendsKeyword]: noType,

  [ts.SyntaxKind.FinallyKeyword]: noType,
  [ts.SyntaxKind.ForKeyword]: noType,
  [ts.SyntaxKind.FunctionKeyword]: noType,
  [ts.SyntaxKind.IfKeyword]: noType,
  [ts.SyntaxKind.ImportKeyword]: noType,
  [ts.SyntaxKind.InKeyword]: noType,
  [ts.SyntaxKind.InstanceOfKeyword]: noType,
  [ts.SyntaxKind.NewKeyword]: noType,
  [ts.SyntaxKind.ReturnKeyword]: noType,
  [ts.SyntaxKind.SwitchKeyword]: noType,
  [ts.SyntaxKind.ThrowKeyword]: noType,
  [ts.SyntaxKind.TryKeyword]: noType,
  [ts.SyntaxKind.TypeOfKeyword]: noType,
  [ts.SyntaxKind.VarKeyword]: noType,
  [ts.SyntaxKind.WhileKeyword]: noType,
  [ts.SyntaxKind.WithKeyword]: noType,
  [ts.SyntaxKind.ImplementsKeyword]: noType,
  [ts.SyntaxKind.InterfaceKeyword]: noType,
  [ts.SyntaxKind.LetKeyword]: noType,
  [ts.SyntaxKind.PackageKeyword]: noType,
  [ts.SyntaxKind.PrivateKeyword]: noType,
  [ts.SyntaxKind.ProtectedKeyword]: noType,
  [ts.SyntaxKind.PublicKeyword]: noType,
  [ts.SyntaxKind.StaticKeyword]: noType,
  [ts.SyntaxKind.YieldKeyword]: noType,
  [ts.SyntaxKind.AbstractKeyword]: noType,
  [ts.SyntaxKind.AsKeyword]: noType,
  [ts.SyntaxKind.AssertsKeyword]: noType,
  [ts.SyntaxKind.AssertKeyword]: noType,
  [ts.SyntaxKind.AsyncKeyword]: noType,
  [ts.SyntaxKind.AwaitKeyword]: noType,
  [ts.SyntaxKind.ConstructorKeyword]: noType,
  [ts.SyntaxKind.DeclareKeyword]: noType,
  [ts.SyntaxKind.GetKeyword]: noType,
  [ts.SyntaxKind.InferKeyword]: noType,
  [ts.SyntaxKind.IntrinsicKeyword]: noType,
  [ts.SyntaxKind.IsKeyword]: noType,
  [ts.SyntaxKind.KeyOfKeyword]: noType,
  [ts.SyntaxKind.ModuleKeyword]: noType,
  [ts.SyntaxKind.NamespaceKeyword]: noType,
  [ts.SyntaxKind.OutKeyword]: noType,
  [ts.SyntaxKind.ReadonlyKeyword]: noType,
  [ts.SyntaxKind.RequireKeyword]: noType,
  [ts.SyntaxKind.SetKeyword]: noType,
  [ts.SyntaxKind.TypeKeyword]: checkerEval,
  [ts.SyntaxKind.FromKeyword]: noType,
  [ts.SyntaxKind.GlobalKeyword]: noType,
  [ts.SyntaxKind.OfKeyword]: noType,
}));
