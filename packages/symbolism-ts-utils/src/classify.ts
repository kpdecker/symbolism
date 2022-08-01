import ts from "typescript";

export function invariantNode<T extends ts.Node>(
  node: ts.Node,
  matcher?: (node: ts.Node) => node is T
): asserts node is T {
  if (!matcher || !matcher(node)) {
    throw new Error(`Unexpected node type: ${ts.SyntaxKind[node.kind]}`);
  }
}

export function isExpression(node: ts.Node): node is ts.Expression {
  return (ts as any).isExpression(node) || ts.isJsxAttributes(node);
}
export function isNamedDeclaration(node: ts.Node): node is ts.NamedDeclaration {
  return isDeclaration(node) && "name" in node;
}
export function isDeclaration(node: ts.Node): node is ts.Declaration {
  return (ts as any).isDeclaration(node);
}
export function isInheritingDeclaration(
  node: ts.Node
): node is ts.ClassLikeDeclaration | ts.InterfaceDeclaration {
  return ts.isClassLike(node) || ts.isInterfaceDeclaration(node);
}

export function isAssignmentExpression(
  node: ts.Node
): node is ts.AssignmentExpression<ts.AssignmentOperatorToken> {
  if (!ts.isBinaryExpression(node)) {
    return false;
  }

  const operator: ts.AssignmentOperator = node.operatorToken
    .kind as ts.AssignmentOperator;
  switch (operator) {
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
    case ts.SyntaxKind.AmpersandAmpersandEqualsToken:
    case ts.SyntaxKind.BarBarEqualsToken:
    case ts.SyntaxKind.QuestionQuestionEqualsToken:
    case ts.SyntaxKind.EqualsToken:
      return true;

    default:
      const defaultAssertion: never = operator;
      return false;
  }
}

export function isTransientSymbol(symbol: ts.Symbol) {
  return (symbol.flags & ts.SymbolFlags.Transient) !== 0;
}

export function isAliasSymbol(symbol: ts.Symbol): boolean {
  return (symbol.flags & ts.SymbolFlags.Alias) !== 0;
}
export function isFunctionLikeDeclaration(
  node: ts.Node
): node is ts.FunctionLikeDeclaration {
  return node && isFunctionLikeDeclarationKind(node.kind);
}

function isFunctionLikeDeclarationKind(kind: ts.SyntaxKind): boolean {
  switch (kind) {
    case ts.SyntaxKind.FunctionDeclaration:
    case ts.SyntaxKind.MethodDeclaration:
    case ts.SyntaxKind.Constructor:
    case ts.SyntaxKind.GetAccessor:
    case ts.SyntaxKind.SetAccessor:
    case ts.SyntaxKind.FunctionExpression:
    case ts.SyntaxKind.ArrowFunction:
      return true;
    default:
      return false;
  }
}

export function isArraySymbol(symbol: ts.Symbol): boolean {
  return symbol.getName() === "Array";
}

export function isErrorType(type: ts.Type | undefined): boolean {
  return (type as any)?.intrinsicName === "error";
}

const intrinsicTypes =
  ts.TypeFlags.Any |
  ts.TypeFlags.Unknown |
  ts.TypeFlags.String |
  ts.TypeFlags.Number |
  ts.TypeFlags.BigInt |
  ts.TypeFlags.Boolean |
  ts.TypeFlags.BooleanLiteral |
  ts.TypeFlags.ESSymbol |
  ts.TypeFlags.Void |
  ts.TypeFlags.Undefined |
  ts.TypeFlags.Null |
  ts.TypeFlags.Never |
  ts.TypeFlags.NonPrimitive;

export function isIntrinsicType(type: ts.Type) {
  return (type.flags & intrinsicTypes) !== 0;
}

export function isTypeReference(
  type: ts.Type | undefined
): type is ts.TypeReference {
  return !!(
    type &&
    type.flags & ts.TypeFlags.Object &&
    (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference
  );
}

export function isTupleType(type: ts.Type): type is ts.TupleType {
  return !!(
    type &&
    type.flags & ts.TypeFlags.Object &&
    (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Tuple
  );
}

export function isTupleTypeReference(
  type: ts.Type | undefined
): type is ts.TupleTypeReference {
  return (
    isTypeReference(type) &&
    !!((type.target as ts.ObjectType).objectFlags & ts.ObjectFlags.Tuple)
  );
}
