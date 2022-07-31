import invariant from "tiny-invariant";
import ts from "typescript";
import {
  getSymbolDeclaration,
  isTupleTypeReference,
} from "@symbolism/ts-utils";
import { dumpFlags, dumpSymbol } from "@symbolism/ts-debug";

interface SchemaNode {
  kind:
    | "literal"
    | "primitive"
    | "object"
    | "array"
    | "tuple"
    | "union"
    | "intersection"
    | "template-literal"
    | "function"
    | "error";
  flags?: string[];
  extra?: any;
}

interface Primitive extends SchemaNode {
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
}

interface Union extends SchemaNode {
  kind: "union";
  items: AnySchemaNode[];
}

interface Intersection extends SchemaNode {
  kind: "intersection";
  items: AnySchemaNode[];
}

interface TemplateLiteral extends SchemaNode {
  kind: "template-literal";
  items: AnySchemaNode[];
}

interface Literal extends SchemaNode {
  kind: "literal";
  value: boolean | string | number | bigint | undefined;
}

interface Object extends SchemaNode {
  kind: "object";
  properties: { [key: string]: SchemaNode };
}
interface Array extends SchemaNode {
  kind: "array";
  items: AnySchemaNode;
}
interface Tuple extends SchemaNode {
  kind: "tuple";
  items: AnySchemaNode[];
  elementFlags: readonly ts.ElementFlags[];
}

interface FunctionSchema extends SchemaNode {
  kind: "function";
  parameters: { name: string; schema: AnySchemaNode }[];
  returnType: AnySchemaNode;
}

export type AnySchemaNode =
  | Primitive
  | Union
  | Intersection
  | Literal
  | TemplateLiteral
  | Object
  | Array
  | Tuple
  | FunctionSchema
  | SchemaNode;

let verbose = false;

export function convertTSTypeToSchema(
  type: ts.Type,
  contextNode: ts.Node,
  checker: ts.TypeChecker
) {
  function convertType(
    type: ts.Type,
    priorTypesHandled = new Set<ts.Type>()
  ): AnySchemaNode {
    if (type.flags & ts.TypeFlags.TypeParameter) {
      type = checker.getApparentType(type);
    }
    const typesHandled = new Set<ts.Type>(priorTypesHandled);

    if (typesHandled.has(type)) {
      return { kind: "error", extra: "Circular type" };
    }
    typesHandled.add(type);

    const objectFlags = (type as ts.ObjectType).objectFlags;

    const literalOrPrimitive =
      convertLiteralOrPrimitive(type) ||
      convertTemplateLiteralType(type, typesHandled);
    if (literalOrPrimitive) {
      return literalOrPrimitive;
    }

    if (type.isUnion()) {
      const items = type.types.map((t) => convertType(t, typesHandled));
      return {
        kind: "union",
        items,
        flags: dumpFlags(type.flags, ts.TypeFlags).concat(
          dumpFlags(objectFlags, ts.ObjectFlags)
        ),
      };
    } else if (type.isIntersection()) {
      let allObjects = true;
      const items = type.types.map((t) => {
        if (t.isLiteral()) {
          allObjects = false;
          return convertType(t, typesHandled);
        }

        const apparentType = checker.getApparentType(t);
        if (
          !(t.flags & ts.TypeFlags.Object) ||
          !(apparentType.flags & ts.TypeFlags.Object)
        ) {
          allObjects = false;
        }
        return convertType(apparentType, typesHandled);
      });

      // If we consist of objects only, then merge we can merge them
      if (allObjects) {
        return convertObjectType(type, typesHandled);
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
      const items: SchemaNode[] = typeArguments.map((elementType) =>
        convertType(elementType, typesHandled)
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
        items: convertType(arrayValueType, typesHandled),
        flags: dumpFlags(type.flags, ts.TypeFlags).concat(
          dumpFlags(objectFlags, ts.ObjectFlags)
        ),
      };
    } else if (type.flags & ts.TypeFlags.Object || type.isClassOrInterface()) {
      const objectFlags = (type as ts.ObjectType).objectFlags;
      const callSignatures = type.getCallSignatures();
      if (callSignatures.length > 0) {
        function convertSignature(signature: ts.Signature): FunctionSchema {
          return {
            kind: "function",
            parameters: signature.parameters.map((parameter) => {
              const declaration = getSymbolDeclaration(parameter);
              invariant(declaration, "Parameter has no declaration");

              return {
                name: parameter.name,
                schema: convertType(
                  checker.getTypeAtLocation(declaration),
                  typesHandled
                ),
              };
            }),
            returnType: convertType(signature.getReturnType(), typesHandled),
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

      return convertObjectType(type, typesHandled);
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
  return convertType(type);

  function convertObjectType(
    type: ts.Type,
    typesHandled: Set<ts.Type>
  ): Object {
    const properties = type
      .getProperties()
      .map((p): [string, SchemaNode] => {
        const propertyDeclaration = getSymbolDeclaration(p);
        if (!propertyDeclaration) {
          return [
            p.getName(),
            {
              kind: "error",
              extra: "no-declaration",
            },
          ];
        }

        const propertyType = checker.getTypeOfSymbolAtLocation(
          p,
          propertyDeclaration
        );

        return [p.getName(), convertType(propertyType, typesHandled)];
      })
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    return {
      kind: "object",
      properties,
    };
  }

  function convertTemplateLiteralType(
    type: ts.Type,
    typesHandled: Set<ts.Type>
  ): TemplateLiteral | undefined {
    if (type.flags & ts.TypeFlags.TemplateLiteral) {
      const templateType = type as ts.TemplateLiteralType;
      const itemTypes = templateType.texts
        .flatMap((text, i) => {
          const textSchema: Literal | undefined = text
            ? { kind: "literal", value: text }
            : undefined;

          return [
            textSchema!,
            templateType.types[i] &&
              convertType(templateType.types[i], typesHandled),
          ];
        })
        .filter(Boolean);

      return {
        kind: "template-literal",
        items: itemTypes,
      };
    }
  }
}

function convertLiteralOrPrimitive(
  type: ts.Type
): Literal | Primitive | undefined {
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
    return {
      kind: "primitive",
      name: "number",
    };
  } else if (type.flags & ts.TypeFlags.BigInt) {
    return {
      kind: "primitive",
      name: "bigint",
    };
  } else if (type.flags & ts.TypeFlags.String) {
    return {
      kind: "primitive",
      name: "string",
    };
  } else if (type.flags & ts.TypeFlags.Any) {
    return {
      kind: "primitive",
      name: "any",
    };
  } else if (type.flags & ts.TypeFlags.Never) {
    return {
      kind: "primitive",
      name: "never",
    };
  } else if (type.flags & ts.TypeFlags.Unknown) {
    return {
      kind: "primitive",
      name: "unknown",
    };
  } else if (type.flags & ts.TypeFlags.Null) {
    return {
      kind: "primitive",
      name: "null",
    };
  } else if (type.flags & ts.TypeFlags.Undefined) {
    return {
      kind: "primitive",
      name: "undefined",
    };
  } else if (type.flags & ts.TypeFlags.Void) {
    return {
      kind: "primitive",
      name: "void",
    };
  } else if (
    type.flags & ts.TypeFlags.ESSymbol ||
    type.flags & ts.TypeFlags.UniqueESSymbol
  ) {
    return {
      kind: "primitive",
      name: "symbol",
    };
  } else if (type.flags & ts.TypeFlags.NonPrimitive) {
    return {
      kind: "primitive",
      name: "object",
    };
  }
}
