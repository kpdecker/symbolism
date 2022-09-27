import { dumpNode, dumpSchema } from "@symbolism/ts-debug";
import { getSymbolDeclaration, isNamedDeclaration } from "@symbolism/ts-utils";
import {
  assertUnreachable,
  logDebug,
  removeDuplicates,
} from "@symbolism/utils";
import invariant from "tiny-invariant";
import ts, { findAncestor } from "typescript";
import { SchemaContext } from "./context";
import { AnySchemaNode, UnionSchema } from "./schema";
import { getNodeSchema } from "./value-eval";
import { getLocalSymbol } from "./value-eval/symbol";

export class SchemaError extends Error {
  constructor(
    message: string,
    schema: AnySchemaNode | AnySchemaNode[] | undefined
  ) {
    const kind = Array.isArray(schema) ? "array" : schema?.kind;
    super(`${message} ${kind}

GOT: ${dumpSchema(schema)}
`);
  }
}

/**
 * Determines if the schema is fully resolved without
 * any non-finite values.
 */
export function isConcreteSchema(type: AnySchemaNode | undefined): boolean {
  if (!type) {
    return false;
  }

  if (type.kind === "literal") {
    return true;
  }

  if (
    type.kind === "primitive" ||
    type.kind === "error" ||
    // Type checker would have resolved this if it was concrete.
    type.kind === "index" ||
    type.kind === "index-access"
  ) {
    return false;
  }

  if (
    type.kind === "union" ||
    type.kind === "intersection" ||
    type.kind === "tuple" ||
    type.kind === "template-literal" ||
    type.kind === "binary-expression"
  ) {
    return type.items.every(isConcreteSchema);
  }

  if (type.kind === "array") {
    return isConcreteSchema(type.items);
  }

  if (type.kind === "object") {
    return (
      Object.values(type.properties).every(isConcreteSchema) &&
      !type.abstractIndexKeys.length
    );
  }

  if (type.kind === "function") {
    return (
      type.parameters.every(({ schema }) => isConcreteSchema(schema)) &&
      isConcreteSchema(type.returnType)
    );
  }

  if (type.kind === "reference") {
    return true;
  }

  // @ts-expect-error Exhaustive switch
  assertUnreachable(type, `Unsupported schema kind ${type.kind}`);
}

export function findParameterDependency(
  node: ts.Node,
  checker: ts.TypeChecker
): ts.ParameterDeclaration | undefined {
  if (ts.isParameter(node)) {
    return node;
  }

  if (ts.isIdentifier(node)) {
    if (isNamedDeclaration(node.parent) && node.parent.name === node) {
      return findParameterDependency(node.parent, checker);
    }

    if (
      ts.isPropertyAccessExpression(node.parent) &&
      node.parent.name === node
    ) {
      return findParameterDependency(node.parent, checker);
    }

    const symbol = getLocalSymbol(node, checker);
    const symbolDeclaration = getSymbolDeclaration(symbol);
    if (symbolDeclaration && symbolDeclaration !== node) {
      return findParameterDependency(symbolDeclaration, checker);
    }

    // No symbol found. This could be due to the variable not being declared.
    logDebug(
      "No symbol found for",
      () => dumpNode(node, checker),
      "parent",
      () => dumpNode(node.parent, checker)
    );
    return undefined;
  }

  if (ts.isVariableDeclaration(node)) {
    if (node.initializer) {
      return findParameterDependency(node.initializer, checker);
    }
    return undefined;
  }

  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node)
  ) {
    return findParameterDependency(node.expression, checker);
  }

  if (ts.isBindingElement(node)) {
    return findParameterDependency(node.parent, checker);
  }
  if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
    return findParameterDependency(node.parent, checker);
  }

  return undefined;
}

export function isParameterInScope(
  /**
   * Node whose scope we are checking.
   * This can be any child of the function defining `parameter
   */
  node: ts.Node,
  parameter: ts.ParameterDeclaration | undefined
) {
  if (!parameter) {
    return false;
  }

  return !!findAncestor(node, (hay) => hay === parameter.parent);
}

export function bindParameterDependency(
  node: ts.Node,
  parameterBinding: { node: ts.ParameterDeclaration; schema: AnySchemaNode },
  context: SchemaContext
): AnySchemaNode | undefined {
  const newContext = context.cloneNode({
    node,
    decrementDepth: false,
  });
  newContext.parameterBindings.set(
    parameterBinding.node,
    parameterBinding.schema
  );

  return getNodeSchema({
    node,
    decrementDepth: false,
    lateBindParameters: true,

    context: newContext,
  });
}

export function unboundInputs(
  scopeContext: ts.Node,
  schema: AnySchemaNode | undefined,
  checker: ts.TypeChecker
): { node: ts.Node; unboundNode: ts.ParameterDeclaration | undefined }[] {
  if (!schema) {
    return [];
  }

  if (schema.node) {
    const unboundNode = findParameterDependency(schema.node, checker);
    if (isParameterInScope(scopeContext, unboundNode)) {
      // This node's value is derived from a parameter
      return [{ node: schema.node, unboundNode }];
    } else {
      return [];
    }
  }

  if (schema.kind === "literal") {
    return [];
  }

  if (
    schema.kind === "primitive" ||
    schema.kind === "error" ||
    // Type checker would have resolved this if it was concrete.
    schema.kind === "index" ||
    schema.kind === "index-access"
  ) {
    if (schema.node) {
      return [
        {
          node: schema.node,
          unboundNode: findParameterDependency(schema.node, checker),
        },
      ];
    }
    return [];
  }

  if (
    schema.kind === "union" ||
    schema.kind === "intersection" ||
    schema.kind === "tuple" ||
    schema.kind === "template-literal" ||
    schema.kind === "binary-expression"
  ) {
    return schema.items.flatMap((item) =>
      unboundInputs(scopeContext, item, checker)
    );
  }

  if (schema.kind === "array") {
    return unboundInputs(scopeContext, schema.items, checker);
  }

  if (schema.kind === "object") {
    const abstractKeysSymbols = schema.abstractIndexKeys.flatMap(
      (abstractKey) =>
        unboundInputs(scopeContext, abstractKey.key, checker).concat(
          unboundInputs(scopeContext, abstractKey.value, checker)
        )
    );

    return Object.values(schema.properties)
      .flatMap((item) => unboundInputs(scopeContext, item, checker))
      .concat(abstractKeysSymbols);
  }

  if (schema.kind === "function") {
    return unboundInputs(scopeContext, schema.returnType, checker).concat(
      ...schema.parameters.flatMap(({ schema }) =>
        unboundInputs(scopeContext, schema, checker)
      )
    );
  }

  if (schema.kind === "reference") {
    return [];
  }

  // @ts-expect-error Exhaustive switch
  assertUnreachable(type, `Unsupported schema kind ${type.kind}`);
}

/**
 * Determines if the schema is fully resolved without
 * any non-finite values.
 */
export function canPrintInJs(type: AnySchemaNode | undefined): boolean {
  if (!type) {
    return true;
  }

  if (type.kind === "literal") {
    return true;
  }

  if (
    type.kind === "primitive" ||
    type.kind === "error" ||
    // Type checker would have resolved this if it was concrete.
    type.kind === "index" ||
    type.kind === "index-access"
  ) {
    return false;
  }

  if (
    type.kind === "union" ||
    type.kind === "intersection" ||
    type.kind === "binary-expression"
  ) {
    return false;
  }
  if (type.kind === "tuple" || type.kind === "template-literal") {
    return type.items.every(canPrintInJs);
  }

  if (type.kind === "array") {
    return false;
  }

  if (type.kind === "object") {
    return (
      Object.values(type.properties).every(canPrintInJs) &&
      !type.abstractIndexKeys.length
    );
  }

  if (type.kind === "function") {
    return false;
  }

  if (type.kind === "reference") {
    // TODO: Maybe, maybe not...
    return false;
  }

  // @ts-expect-error Exhaustive switch
  assertUnreachable(type, `Unsupported schema kind ${type.kind}`);
}

export function isLiteralUnion(type: AnySchemaNode): type is UnionSchema {
  return (
    type.kind === "union" && type.items.every((item) => item.kind === "literal")
  );
}

export function isNumericSchema(type: AnySchemaNode): boolean {
  if (
    type.kind === "union" ||
    type.kind === "intersection" ||
    type.kind === "binary-expression"
  ) {
    return type.items.every(isNumericSchema);
  }

  return (
    (type.kind === "primitive" && type.name === "number") ||
    (type.kind === "literal" && typeof type.value === "number")
  );
}
export function isBooleanSchema(type: AnySchemaNode): boolean {
  if (
    type.kind === "union" ||
    type.kind === "intersection" ||
    type.kind === "binary-expression"
  ) {
    return type.items.every(isBooleanSchema);
  }

  return (
    (type.kind === "primitive" && type.name === "boolean") ||
    (type.kind === "literal" && typeof type.value === "boolean")
  );
}

export function removeDuplicateSchemas<
  T extends AnySchemaNode | AnySchemaNode[]
>(schemas: T[]) {
  // Filter identical items
  return removeDuplicates(schemas, areSchemasEqual);
}
export function areSchemasEqual(
  a: AnySchemaNode | AnySchemaNode[] | undefined,
  b: AnySchemaNode | AnySchemaNode[] | undefined
): boolean {
  if (!a || !b) {
    return a === b;
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      return false;
    }

    return (
      a.length === b.length &&
      a.every((item, schemaIndex) => areSchemasEqual(item, b[schemaIndex]))
    );
  }
  invariant(!Array.isArray(b));

  if (a.kind === "primitive") {
    return a.kind === b.kind && a.name === b.name;
  }

  if (
    a.kind === "error" ||
    // Type checker would have resolved this if it was concrete.
    a.kind === "index" ||
    a.kind === "index-access"
  ) {
    return a.kind === b.kind && a.node === b.node;
  }

  if (a.kind === "literal") {
    return (
      b.kind === "literal" &&
      (a.value === b.value ||
        (Number.isNaN(a.value as unknown) && Number.isNaN(b.value as unknown)))
    );
  }

  if (
    a.kind === "union" ||
    a.kind === "intersection" ||
    a.kind === "tuple" ||
    a.kind === "template-literal" ||
    a.kind === "binary-expression"
  ) {
    return (
      a.kind === b.kind &&
      a.items.length === b.items.length &&
      a.items.every((item, index) => areSchemasEqual(item, b.items[index]))
    );
  }

  if (a.kind === "array") {
    return b.kind === "array" && areSchemasEqual(a.items, b.items);
  }

  if (a.kind === "object") {
    if (b.kind !== "object") {
      return false;
    }

    const aProperties = Object.keys(a.properties);
    const bProperties = Object.keys(b.properties);
    return (
      aProperties.length === bProperties.length &&
      aProperties.every((key) =>
        areSchemasEqual(a.properties[key], b.properties[key])
      ) &&
      a.abstractIndexKeys.length === b.abstractIndexKeys.length &&
      a.abstractIndexKeys.every(
        (aIndexKey, i) =>
          areSchemasEqual(aIndexKey.key, b.abstractIndexKeys[i].key) &&
          areSchemasEqual(aIndexKey.value, b.abstractIndexKeys[i].value)
      )
    );
  }

  if (a.kind === "function") {
    return (
      b.kind === "function" &&
      areSchemasEqual(a.returnType, b.returnType) &&
      a.parameters.length === b.parameters.length &&
      a.parameters.every((parameter, i) =>
        areSchemasEqual(parameter.schema, b.parameters[i].schema)
      )
    );
  }

  if (a.kind === "reference") {
    return (
      b.kind === "reference" &&
      a.name === b.name &&
      a.parameters.length === b.parameters.length &&
      a.parameters.every((parameter, i) =>
        areSchemasEqual(parameter, b.parameters[i])
      )
    );
  }

  // @ts-expect-error Exhaustive switch
  assertUnreachable(a, `Unsupported schema kind ${a.kind}`);
}
