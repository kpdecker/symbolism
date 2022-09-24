import { NodeError } from "@symbolism/utils";
import ts, { InternalSymbolName } from "typescript";
import type { Opaque } from "type-fest";

import { getSymbolDeclaration } from "./lookup";
import { relative } from "path";
import { getIntrinsicName, isThisType } from "./internal-apis";

export function invariantNode<T extends ts.Node>(
  node: ts.Node,
  checker: ts.TypeChecker,
  matcher?: (node: ts.Node) => node is T
): asserts node is T {
  if (!matcher || !matcher(node)) {
    throw new NodeError(
      `Unexpected node type: ${ts.SyntaxKind[node.kind]}`,
      node,
      checker
    );
  }
}

export function isExpression(node: ts.Node): node is ts.Expression {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ts as any).isExpression(node) || ts.isJsxAttributes(node);
}
export function isNamedDeclaration(node: ts.Node): node is ts.NamedDeclaration {
  return isDeclaration(node) && "name" in node;
}
export function isDeclaration(node: ts.Node): node is ts.Declaration {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line no-fallthrough
    case ts.SyntaxKind.LessThanLessThanEqualsToken:
    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
    case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
    case ts.SyntaxKind.AmpersandAmpersandEqualsToken:
    case ts.SyntaxKind.BarBarEqualsToken:
    case ts.SyntaxKind.QuestionQuestionEqualsToken:
    case ts.SyntaxKind.EqualsToken:
      return true;

    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const defaultAssertion: never = operator;
      return false;
    }
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
  return getIntrinsicName(type) === "error";
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
  ts.TypeFlags.UniqueESSymbol |
  ts.TypeFlags.NonPrimitive;

export function isIntrinsicType(type: ts.Type | undefined): boolean {
  return !!type?.flags && (type.flags & intrinsicTypes) !== 0;
}

export type TypeId = Opaque<string, "TypeId">;
export function isNamedType(type: ts.Type): boolean {
  return !!getTypeName(type);
}
export function getTypeName(type: ts.Type): string | undefined {
  if (isTupleTypeReference(type) || type.flags & ts.TypeFlags.StringMapping) {
    return undefined;
  }

  if (type.isLiteral()) {
    return undefined;
  }

  let name = type.aliasSymbol?.name;

  if (isTypeReference(type) && name === "Array") {
    if (type.typeArguments && isIntrinsicType(type.typeArguments[0])) {
      return undefined;
    }
  }

  if (!name && type.symbol?.name) {
    const symbolDeclaration = getSymbolDeclaration(type.symbol);
    if (symbolDeclaration) {
      // Don't independently name object properties.
      if (
        ts.isObjectLiteralElementLike(symbolDeclaration) ||
        ts.isClassOrTypeElement(symbolDeclaration) ||
        ts.isTypeParameterDeclaration(symbolDeclaration)
      ) {
        return undefined;
      }
    }
    name = type.symbol.name;
  }

  if (
    Object.values(ts.InternalSymbolName).includes(name as InternalSymbolName)
  ) {
    return undefined;
  }

  return name;
}
export function getTypeId(
  type: ts.Type,
  checker: ts.TypeChecker,
  requireUnique: boolean
): TypeId {
  const symbolDeclaration = getSymbolDeclaration(type.symbol);

  // Always scope to the local file.
  const sourceFile = symbolDeclaration?.getSourceFile().fileName;
  const fileNameSpace =
    requireUnique && sourceFile ? `/* ${relative(",", sourceFile)} */ ` : "";

  return (fileNameSpace +
    checker.typeToString(
      type,
      symbolDeclaration,
      ts.TypeFormatFlags.UseFullyQualifiedType |
        ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope
    )) as TypeId;
}

export function isThisTypeParameter(
  type: ts.Type | undefined
): type is ts.TypeParameter {
  return !!type?.isTypeParameter() && isThisType(type);
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
