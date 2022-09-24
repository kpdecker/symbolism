import ts from "typescript";

interface InternalTypeChecker extends ts.TypeChecker {
  isArrayType(type: ts.Type): boolean;
  tryGetThisTypeAt(node: ts.Node): ts.Type | undefined;
  resolveExternalModuleName(
    moduleSpecifier: ts.Expression
  ): ts.Symbol | undefined;
}

export function isArrayType(type: ts.Type, checker: ts.TypeChecker): boolean {
  return (checker as InternalTypeChecker)?.isArrayType(type);
}

export function tryGetThisTypeAt(checker: ts.TypeChecker, node: ts.Node) {
  return (checker as InternalTypeChecker).tryGetThisTypeAt(node);
}

export function resolveExternalModuleName(
  checker: ts.TypeChecker,
  moduleSpecifier: ts.Expression
) {
  return (checker as InternalTypeChecker).resolveExternalModuleName(
    moduleSpecifier
  );
}

interface InternalSymbol extends ts.Symbol {
  bindingElement?: ts.BindingElement;
  id?: unknown;
  parent?: ts.Symbol;
}

export function getBindingElement(symbol: ts.Symbol | undefined) {
  return (symbol as InternalSymbol)?.bindingElement;
}

export function getSymbolId(symbol: ts.Symbol | undefined) {
  return (symbol as InternalSymbol)?.id;
}

export function getSymbolParent(symbol: ts.Symbol | undefined) {
  return (symbol as InternalSymbol)?.parent;
}

interface InternalType extends ts.Type {
  intrinsicName?: string;
  isThisType?: boolean;
  resolvedTypeArguments?: ts.Type[];
}

export function getIntrinsicName(type: ts.Type | undefined) {
  return (type as InternalType)?.intrinsicName;
}

export function isThisType(type: ts.Type) {
  return !!(type as InternalType)?.isThisType;
}

export function getResolvedTypeArguments(type: ts.Type | undefined) {
  return (type as InternalType)?.resolvedTypeArguments;
}

interface InternalSignature extends ts.Signature {
  mapper?: unknown;
}

export function getSignatureMapper(signature: ts.Signature | undefined) {
  return (signature as InternalSignature)?.mapper;
}
