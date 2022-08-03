import invariant from "tiny-invariant";
import ts from "typescript";
import {
  getSymbolDeclaration,
  isTupleTypeReference,
} from "@symbolism/ts-utils";
import { dumpFlags, dumpSymbol } from "@symbolism/ts-debug";
import { convertValueExpression, narrowTypeFromValues } from "./value-eval";
import { evaluateBinaryExpressionSchema } from "./value-eval/binary-expression";

interface SchemaNode {
  flags?: string[];
  extra?: any;
}

export interface PrimitiveSchema extends SchemaNode {
  kind: "primitive";
  name: // JS
  | "string"
    | "number"
    | "boolean"
    | "bigint"
    | "symbol"
    | "undefined"
    | "null"
    | "void"

    // Extended JS
    | "symbol"

    // TS
    | "object"
    | "unknown"
    | "any"
    | "never";
  node: ts.Node;
}

export interface UnionSchema extends SchemaNode {
  kind: "union";
  items: AnySchemaNode[];
}

export interface IntersectionSchema extends SchemaNode {
  kind: "intersection";
  items: AnySchemaNode[];
}

export interface TemplateLiteralSchema extends SchemaNode {
  kind: "template-literal";
  items: AnySchemaNode[];
}

export interface LiteralSchema extends SchemaNode {
  kind: "literal";
  value: boolean | string | number | bigint | undefined;
}

export interface ObjectSchema extends SchemaNode {
  kind: "object";
  properties: { [key: string]: AnySchemaNode };
}
export interface ArraySchema extends SchemaNode {
  kind: "array";
  items: AnySchemaNode;
}
export interface TupleSchema extends SchemaNode {
  kind: "tuple";
  items: AnySchemaNode[];
  elementFlags: readonly ts.ElementFlags[];
}

export interface FunctionSchema extends SchemaNode {
  kind: "function";
  parameters: {
    name: string;
    schema: AnySchemaNode;
    symbol: ts.Symbol | undefined;
  }[];
  returnType: AnySchemaNode;
}

export interface BinaryExpressionSchema extends SchemaNode {
  kind: "binary-expression";
  operator: ts.BinaryOperator;
  items: AnySchemaNode[];
}

export interface IndexSchema extends SchemaNode {
  kind: "index";
  type: AnySchemaNode;
  node: ts.Node;
}

export interface IndexAccessSchema extends SchemaNode {
  kind: "index-access";
  object: AnySchemaNode;
  index: AnySchemaNode;
  node: ts.Node;
}

export interface ErrorSchema extends SchemaNode {
  kind: "error";
  node: ts.Node;
}

export type AnySchemaNode =
  | PrimitiveSchema
  | UnionSchema
  | IntersectionSchema
  | LiteralSchema
  | TemplateLiteralSchema
  | ObjectSchema
  | ArraySchema
  | TupleSchema
  | IndexSchema
  | IndexAccessSchema
  | FunctionSchema
  | BinaryExpressionSchema
  | ErrorSchema;

export class SchemaContext {
  contextNode: ts.Node;
  checker: ts.TypeChecker;
  typesHandled: Set<ts.Type>;

  findContextNode(type: ts.Type, contextNode: ts.Node): ts.Node {
    if (type.symbol) {
      const declaration = getSymbolDeclaration(type.symbol);
      if (declaration) {
        return declaration;
      }
    }

    return contextNode;
  }

  clone(type: ts.Type, node?: ts.Node): [ts.Type, SchemaContext];
  clone(type: undefined, node: ts.Node): [ts.Type, SchemaContext];
  clone(
    type?: ts.Type,
    node: ts.Node = this.findContextNode(type!, this.contextNode)
  ) {
    if (!type) {
      type = this.checker.getTypeAtLocation(node);
    }

    const ret = new SchemaContext(node, this.checker);
    ret.typesHandled = new Set<ts.Type>(this.typesHandled);

    return [type, ret] as const;
  }

  cloneNode<T extends ts.Node>(node: T) {
    const ret = new SchemaContext(node, this.checker);
    ret.typesHandled = new Set<ts.Type>(this.typesHandled);

    return [node, ret] as const;
  }

  constructor(contextNode: ts.Node, checker: ts.TypeChecker) {
    this.contextNode = contextNode;
    this.checker = checker;
    this.typesHandled = new Set<ts.Type>();
  }
}

export function convertTSTypeToSchema(
  type: ts.Type,
  context: SchemaContext
): AnySchemaNode {
  const { contextNode, checker, typesHandled } = context;

  if (type.flags & ts.TypeFlags.TypeParameter) {
    type = checker.getApparentType(type);
  }

  if (typesHandled.has(type)) {
    return { kind: "error", extra: "Circular type", node: contextNode };
  }
  typesHandled.add(type);

  const objectFlags = (type as ts.ObjectType).objectFlags;

  const literalOrPrimitive =
    convertLiteralOrPrimitive(type, context) ||
    convertTemplateLiteralType(type, context);
  if (literalOrPrimitive) {
    return literalOrPrimitive;
  }

  if (type.isUnion()) {
    const items = type.types.map((t) =>
      convertTSTypeToSchema(...context.clone(t))
    );
    return {
      kind: "union",
      items,
    };
  } else if (type.isIntersection()) {
    let allObjects = true;
    const items = type.types.map((t) => {
      if (t.isLiteral()) {
        allObjects = false;
        return convertTSTypeToSchema(...context.clone(t));
      }

      const apparentType = checker.getApparentType(t);
      if (
        !(t.flags & ts.TypeFlags.Object) ||
        !(apparentType.flags & ts.TypeFlags.Object)
      ) {
        allObjects = false;
      }
      return convertTSTypeToSchema(...context.clone(apparentType));
    });

    // If we consist of objects only, then merge we can merge them
    if (allObjects) {
      return convertObjectType(...context.clone(type));
    }

    return {
      kind: "intersection",
      items,
      flags: dumpFlags(type.flags, ts.TypeFlags).concat(
        dumpFlags(objectFlags, ts.ObjectFlags)
      ),
    };
  } else if (isTupleTypeReference(type)) {
    const tupleType = type.target;

    const typeArguments = checker.getTypeArguments(type);
    const items: AnySchemaNode[] = typeArguments.map((elementType) =>
      convertTSTypeToSchema(...context.clone(elementType))
    );

    return {
      kind: "tuple",
      items,
      elementFlags: tupleType.elementFlags,
    };
  } else if ((checker as any).isArrayType(type) || type.getNumberIndexType()) {
    const arrayValueType = checker.getIndexTypeOfType(
      type,
      ts.IndexKind.Number
    );
    invariant(arrayValueType, "Array type has no number index type");

    return {
      kind: "array",
      items: convertTSTypeToSchema(...context.clone(arrayValueType)),
      flags: dumpFlags(type.flags, ts.TypeFlags).concat(
        dumpFlags(objectFlags, ts.ObjectFlags)
      ),
    };
  } else if (type.flags & ts.TypeFlags.Object || type.isClassOrInterface()) {
    const objectFlags = (type as ts.ObjectType).objectFlags;
    const callSignatures = type.getCallSignatures();
    if (callSignatures.length > 0) {
      function convertSignature(signature: ts.Signature): FunctionSchema {
        const returnType = signature.getReturnType();
        return {
          kind: "function",
          parameters: signature.parameters.map((parameter) => {
            const declaration = getSymbolDeclaration(
              parameter
            ) as ts.ParameterDeclaration;
            invariant(declaration, "Parameter has no declaration");

            return {
              name: parameter.name,
              schema: convertTSTypeToSchema(
                ...context.clone(checker.getTypeAtLocation(declaration))
              ),
              symbol: parameter,
            };
          }),
          returnType: convertTSTypeToSchema(...context.clone(returnType)),
        };
      }
      if (callSignatures.length > 1) {
        return {
          kind: "union",
          items: callSignatures.map(convertSignature),
        };
      }
      return convertSignature(callSignatures[0]);
    }

    if (type.symbol?.getName() === "Date") {
      const declaration = getSymbolDeclaration(type.symbol);
      if (
        declaration &&
        declaration.getSourceFile().fileName.includes("lib.es5.d.ts")
      ) {
        return {
          kind: "literal",
          value: "Date",
        };
      }
    }

    return convertObjectType(...context.clone(type));
  } else if (type.flags & ts.TypeFlags.Index) {
    const index = type as ts.IndexType;
    const clone = context.clone(index.type);

    return {
      kind: "index",
      type: convertTSTypeToSchema(...clone),
      node: clone[1].contextNode,
    };
  } else if (type.flags & ts.TypeFlags.IndexedAccess) {
    const indexAccess = type as ts.IndexedAccessType;
    return {
      kind: "index-access",
      object: convertTSTypeToSchema(...context.clone(indexAccess.objectType)),
      index: convertTSTypeToSchema(...context.clone(indexAccess.indexType)),
      node: contextNode,
    };
  } else {
    /* istanbul ignore next Sanity */
    console.log(
      type,
      Object.keys(type),
      type.isLiteral(),
      type.isNumberLiteral(),
      dumpFlags(type.flags, ts.TypeFlags),
      type.symbol && dumpSymbol(type.symbol, checker)
    );

    /* istanbul ignore next Sanity */
    throw new Error(`Unsupported type ${checker.typeToString(type)}`);
  }
}

function convertObjectType(
  type: ts.Type,
  context: SchemaContext
): ObjectSchema {
  const { contextNode, checker } = context;
  const properties: Record<string, AnySchemaNode> = type
    .getProperties()
    .map((p): [string, AnySchemaNode] => {
      const propertyDeclaration = getSymbolDeclaration(p);
      if (!propertyDeclaration) {
        return [
          p.getName(),
          {
            kind: "error",
            extra: "no-declaration",
            node: contextNode,
          },
        ];
      }

      const propertyType = checker.getTypeOfSymbolAtLocation(
        p,
        propertyDeclaration
      );

      return [
        p.getName(),
        convertTSTypeToSchema(
          ...context.clone(propertyType, propertyDeclaration)
        ),
      ];
    })
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

  // Note that this is not typescript syntax compliant
  const stringIndexType = type.getStringIndexType();
  if (stringIndexType) {
    properties["__index"] = convertTSTypeToSchema(
      ...context.clone(stringIndexType)
    );
  }

  return {
    kind: "object",
    properties,
  };
}

function convertTemplateLiteralType(
  type: ts.Type,
  context: SchemaContext
): TemplateLiteralSchema | undefined {
  if (type.flags & ts.TypeFlags.TemplateLiteral) {
    const templateType = type as ts.TemplateLiteralType;
    const itemTypes = templateType.texts
      .flatMap((text, i) => {
        const textSchema: LiteralSchema | undefined = text
          ? { kind: "literal", value: text }
          : undefined;

        const itemType = templateType.types[i];
        return [
          textSchema!,
          itemType && convertTSTypeToSchema(...context.clone(itemType)),
        ];
      })
      .filter(Boolean);

    return {
      kind: "template-literal",
      items: itemTypes,
    };
  }
}

function convertLiteralOrPrimitive(
  type: ts.Type,
  context: SchemaContext
): AnySchemaNode | undefined {
  const { contextNode } = context;

  if (type.flags & ts.TypeFlags.BigIntLiteral) {
    const literalType = type as ts.BigIntLiteralType;
    return {
      kind: "literal",
      value: BigInt(
        literalType.value.negative ? "-" : "" + literalType.value.base10Value
      ),
    };
  } else if (type.isLiteral()) {
    const literalType = type as ts.LiteralType;
    return {
      kind: "literal",
      value: literalType.value as Exclude<
        ts.LiteralType["value"],
        ts.PseudoBigInt
      >,
    };
  } else if (type.flags & ts.TypeFlags.BooleanLiteral) {
    return {
      kind: "literal",
      value: (type as any).intrinsicName === "true",
    };
  } else if (type.flags & ts.TypeFlags.Number) {
    return (
      narrowTypeFromValues(...context.clone(type)) || {
        kind: "primitive",
        name: "number",
        node: contextNode,
      }
    );
  } else if (type.flags & ts.TypeFlags.BigInt) {
    return (
      narrowTypeFromValues(...context.clone(type)) || {
        kind: "primitive",
        name: "bigint",
        node: contextNode,
      }
    );
  } else if (type.flags & ts.TypeFlags.String) {
    return (
      narrowTypeFromValues(...context.clone(type)) || {
        kind: "primitive",
        name: "string",
        node: contextNode,
      }
    );
  } else if (type.flags & ts.TypeFlags.Any) {
    return (
      narrowTypeFromValues(...context.clone(type)) || {
        kind: "primitive",
        name: "any",
        node: contextNode,
      }
    );
  } else if (type.flags & ts.TypeFlags.Never) {
    return {
      kind: "primitive",
      name: "never",
      node: contextNode,
    };
  } else if (type.flags & ts.TypeFlags.Unknown) {
    return (
      narrowTypeFromValues(...context.clone(type)) || {
        kind: "primitive",
        name: "unknown",
        node: contextNode,
      }
    );
  } else if (type.flags & ts.TypeFlags.Null) {
    return {
      kind: "primitive",
      name: "null",
      node: contextNode,
    };
  } else if (type.flags & ts.TypeFlags.Undefined) {
    return {
      kind: "primitive",
      name: "undefined",
      node: contextNode,
    };
  } else if (type.flags & ts.TypeFlags.Void) {
    return {
      kind: "primitive",
      name: "void",
      node: contextNode,
    };
  } else if (
    type.flags & ts.TypeFlags.ESSymbol ||
    type.flags & ts.TypeFlags.UniqueESSymbol
  ) {
    return {
      kind: "primitive",
      name: "symbol",
      node: contextNode,
    };
  } else if (type.flags & ts.TypeFlags.NonPrimitive) {
    return {
      kind: "primitive",
      name: "object",
      node: contextNode,
    };
  }
}
