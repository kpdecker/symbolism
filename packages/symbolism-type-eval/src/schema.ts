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
  parameters: { name: string; schema: AnySchemaNode }[];
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

export function convertTSTypeToSchema(
  _type: ts.Type,
  _contextNode: ts.Node,
  checker: ts.TypeChecker
) {
  function convertType(
    type: ts.Type,
    contextNode: ts.Node,
    priorTypesHandled = new Set<ts.Type>()
  ): AnySchemaNode {
    if (type.flags & ts.TypeFlags.TypeParameter) {
      type = checker.getApparentType(type);
    }
    const typesHandled = new Set<ts.Type>(priorTypesHandled);

    if (typesHandled.has(type)) {
      return { kind: "error", extra: "Circular type", node: contextNode };
    }
    typesHandled.add(type);

    const objectFlags = (type as ts.ObjectType).objectFlags;

    const literalOrPrimitive =
      convertLiteralOrPrimitive(type, contextNode, typesHandled) ||
      convertTemplateLiteralType(type, contextNode, typesHandled);
    if (literalOrPrimitive) {
      return literalOrPrimitive;
    }

    if (type.isUnion()) {
      const items = type.types.map((t) =>
        convertType(t, findContextNode(t, contextNode), typesHandled)
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
          return convertType(t, findContextNode(t, contextNode), typesHandled);
        }

        const apparentType = checker.getApparentType(t);
        if (
          !(t.flags & ts.TypeFlags.Object) ||
          !(apparentType.flags & ts.TypeFlags.Object)
        ) {
          allObjects = false;
        }
        return convertType(
          apparentType,
          findContextNode(apparentType, contextNode),
          typesHandled
        );
      });

      // If we consist of objects only, then merge we can merge them
      if (allObjects) {
        return convertObjectType(
          type,
          findContextNode(type, contextNode),
          typesHandled
        );
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
        convertType(
          elementType,
          findContextNode(elementType, contextNode),
          typesHandled
        )
      );

      return {
        kind: "tuple",
        items,
        elementFlags: tupleType.elementFlags,
      };
    } else if (
      (checker as any).isArrayType(type) ||
      type.getNumberIndexType()
    ) {
      const arrayValueType = checker.getIndexTypeOfType(
        type,
        ts.IndexKind.Number
      );
      invariant(arrayValueType, "Array type has no number index type");

      return {
        kind: "array",
        items: convertType(
          arrayValueType,
          findContextNode(arrayValueType, contextNode),
          typesHandled
        ),
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
                schema: convertType(
                  checker.getTypeAtLocation(declaration),
                  declaration,
                  typesHandled
                ),
              };
            }),
            returnType: convertType(
              returnType,
              findContextNode(returnType, contextNode),
              typesHandled
            ),
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

      return convertObjectType(
        type,
        findContextNode(type, contextNode),
        typesHandled
      );
    } else if (type.flags & ts.TypeFlags.Index) {
      const index = type as ts.IndexType;

      const indexContextNode = findContextNode(index.type, contextNode);
      return {
        kind: "index",
        type: convertType(index.type, indexContextNode, typesHandled),
        node: indexContextNode,
      };
    } else if (type.flags & ts.TypeFlags.IndexedAccess) {
      const indexAccess = type as ts.IndexedAccessType;
      return {
        kind: "index-access",
        object: convertType(indexAccess.objectType, contextNode, typesHandled),
        index: convertType(indexAccess.indexType, contextNode, typesHandled),
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

  return convertType(_type, _contextNode);

  function findContextNode(type: ts.Type, contextNode: ts.Node): ts.Node {
    if (type.symbol) {
      const declaration = getSymbolDeclaration(type.symbol);
      if (declaration) {
        return declaration;
      }
    }

    return contextNode;
  }

  function convertObjectType(
    type: ts.Type,
    contextNode: ts.Node,
    typesHandled: Set<ts.Type>
  ): ObjectSchema {
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
          convertType(propertyType, propertyDeclaration, typesHandled),
        ];
      })
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    // Note that this is not typescript syntax compliant
    const stringIndexType = type.getStringIndexType();
    if (stringIndexType) {
      properties["__index"] = convertType(
        stringIndexType,
        findContextNode(stringIndexType, contextNode),
        typesHandled
      );
    }

    return {
      kind: "object",
      properties,
    };
  }

  function convertTemplateLiteralType(
    type: ts.Type,
    contextNode: ts.Node,
    typesHandled: Set<ts.Type>
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
            itemType &&
              convertType(
                itemType,
                findContextNode(itemType, contextNode),
                typesHandled
              ),
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
    contextNode: ts.Node,
    typesHandled: Set<ts.Type>
  ): AnySchemaNode | undefined {
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
        narrowTypeFromValues(type, contextNode, checker, typesHandled) || {
          kind: "primitive",
          name: "number",
          node: contextNode,
        }
      );
    } else if (type.flags & ts.TypeFlags.BigInt) {
      return (
        narrowTypeFromValues(type, contextNode, checker, typesHandled) || {
          kind: "primitive",
          name: "bigint",
          node: contextNode,
        }
      );
    } else if (type.flags & ts.TypeFlags.String) {
      return (
        narrowTypeFromValues(type, contextNode, checker, typesHandled) || {
          kind: "primitive",
          name: "string",
          node: contextNode,
        }
      );
    } else if (type.flags & ts.TypeFlags.Any) {
      return (
        narrowTypeFromValues(type, contextNode, checker, typesHandled) || {
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
        narrowTypeFromValues(type, contextNode, checker, typesHandled) || {
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
}
