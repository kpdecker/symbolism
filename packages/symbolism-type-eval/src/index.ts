import invariant from "tiny-invariant";
import ts from "typescript";
import {
  getSymbolDeclaration,
  isTupleType,
  isTupleTypeReference,
  isTypeReference,
} from "@symbolism/ts-utils";
import { dumpFlags, dumpSymbol } from "@symbolism/ts-debug";

interface SchemaNode {
  kind:
    | "literal"
    | "string"
    | "number"
    | "any"
    | "never"
    | "object"
    | "array"
    | "tuple"
    | "union"
    | "intersection"
    | "error";
  flags?: string[];
  extra?: any;
}

interface Union extends SchemaNode {
  kind: "union";
  items: SchemaNode[];
}

interface Intersection extends SchemaNode {
  kind: "intersection";
  items: SchemaNode[];
}

interface Literal extends SchemaNode {
  kind: "literal";
  value: boolean | string | number | ts.PseudoBigInt | undefined;
}

interface Object extends SchemaNode {
  kind: "object";
  properties: { [key: string]: SchemaNode };
}
interface Array extends SchemaNode {
  kind: "array";
  items: SchemaNode;
}
interface Tuple extends SchemaNode {
  kind: "tuple";
  items: SchemaNode[];
}

export type AnySchemaNode =
  | Union
  | Intersection
  | Literal
  | Object
  | Array
  | Tuple
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

    const target = isTypeReference(type) && type.target;

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
      const items = type.types.map((t) => convertType(t, typesHandled));
      return {
        kind: "intersection",
        items,
        flags: dumpFlags(type.flags, ts.TypeFlags).concat(
          dumpFlags(objectFlags, ts.ObjectFlags)
        ),
      };
    } else if (type.isLiteral()) {
      return {
        kind: "literal",
        value: type.value,
      };
    } else if (type.flags & ts.TypeFlags.BooleanLiteral) {
      return {
        kind: "literal",
        value: (type as any).intrinsicName === "true",
      };
    } else if (type.flags & ts.TypeFlags.Number) {
      return {
        kind: "number",
      };
    } else if (type.flags & ts.TypeFlags.String) {
      return {
        kind: "string",
      };
    } else if (type.flags & ts.TypeFlags.Any) {
      return {
        kind: "any",
      };
    } else if (type.flags & ts.TypeFlags.Never) {
      return {
        kind: "never",
      };
    } else if (type.flags & ts.TypeFlags.UniqueESSymbol) {
      // TODO: disable?
      return {
        kind: "literal",
        value: checker.typeToString(type),
        // flags: dumpFlags(type.flags, ts.TypeFlags).concat(
        //   dumpFlags(objectFlags, ts.ObjectFlags)
        // ),
      };
    } else if (type.isClass()) {
      return {
        kind: "error",
        extra: "class",
        flags: dumpFlags(type.flags, ts.TypeFlags).concat(
          dumpFlags(objectFlags, ts.ObjectFlags)
        ),
      };
    } else if (isTupleTypeReference(type)) {
      // TODO: Rest and optional params
      const items: SchemaNode[] = checker
        .getTypeArguments(type)
        .map((elementType) => convertType(elementType, typesHandled));

      return {
        kind: "tuple",
        items,
        flags: dumpFlags(type.flags, ts.TypeFlags).concat(
          dumpFlags(objectFlags, ts.ObjectFlags)
        ),
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

      const length = arrayValueType.getProperty("length");
      const lengthDeclaration = getSymbolDeclaration(length);
      const lengthType =
        length &&
        lengthDeclaration &&
        checker.getTypeOfSymbolAtLocation(length, lengthDeclaration);

      // TODO: Array for template types

      if (verbose) {
        console.log({
          kind: "array",
          items: convertType(arrayValueType, typesHandled),
          flags: dumpFlags(type.flags, ts.TypeFlags).concat(
            dumpFlags(objectFlags, ts.ObjectFlags)
          ),
          length: lengthType && checker.typeToString(lengthType),
          isTuple: target && isTupleType(target),
          tupleRef: isTupleTypeReference(type),
          tupleType: isTupleType(type),
          targetFlags: dumpFlags((target as any).flags, ts.TypeFlags),
          isTypeRef: isTypeReference(type),
        });
        console.log(type);
      }

      return {
        kind: "array",
        items: convertType(arrayValueType, typesHandled),
        flags: dumpFlags(type.flags, ts.TypeFlags).concat(
          dumpFlags(objectFlags, ts.ObjectFlags)
        ),
      };
    } else if (type.flags & ts.TypeFlags.Object) {
      if (type.getCallSignatures().length > 0) {
        return {
          kind: "error",
          extra:
            "function " +
            checker.typeToString(type) +
            " " +
            JSON.stringify(dumpSymbol(type.getSymbol(), checker)),
        };
      }

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
                flags: dumpFlags(type.flags, ts.TypeFlags).concat(
                  dumpFlags(objectFlags, ts.ObjectFlags)
                ),
              },
            ];
          }

          try {
            const propertyType = checker.getTypeOfSymbolAtLocation(
              p,
              propertyDeclaration
            );

            if (p.getName() === "workingOut_") {
              verbose = true;
              console.log(propertyDeclaration);
              console.log("propertyType", propertyType);
            }

            return [p.getName(), convertType(propertyType, typesHandled)];
          } finally {
            if (p.getName() === "workingOut") {
              verbose = false;
            }
          }
        })
        .reduce(
          (acc, [key, value]) => ({ ...acc, [JSON.stringify(key)]: value }),
          {}
        );

      return {
        kind: "object",
        properties,
        flags: dumpFlags(type.flags, ts.TypeFlags).concat(
          dumpFlags(objectFlags, ts.ObjectFlags)
        ),
      };
    } else if (type.flags & ts.TypeFlags.TypeParameter) {
      console.log("typeParameter", checker.getApparentType(type));
      return {
        kind: "error",
        extra: "type-parameter",
      };
    } else {
      console.log(
        type,
        Object.keys(type),
        type.isLiteral(),
        type.isNumberLiteral(),
        dumpFlags(type.flags, ts.TypeFlags),
        type.symbol && dumpSymbol(type.symbol, checker)
      );
      throw new Error(`Unsupported type ${checker.typeToString(type)}`);
    }
  }
  return convertType(type);
}

export function printSchema(schema: AnySchemaNode): string {
  function printString(str: string): string {
    return str
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n");
  }
  switch (schema.kind) {
    case "number":
      return "number";
    case "string":
      return "string";
    case "any":
    case "never":
      return schema.kind;
    case "literal":
      invariant("value" in schema);
      return typeof schema.value === "string"
        ? `"${schema.value}"`
        : schema.value + "";
    case "array":
      invariant("items" in schema);
      return `(${printSchema(schema.items)})[]`;
    case "tuple":
      invariant("items" in schema);
      return `[${schema.items.map(printSchema).join(", ")}]`;
    case "object":
      invariant("properties" in schema);

      const keys = Object.keys(schema.properties);
      if (keys.length === 1) {
        return `{ ${keys[0]}: ${printSchema(schema.properties[keys[0]])} }`;
      }

      return (
        "{\n" +
        printString(
          Object.keys(schema.properties)
            .sort()
            .map((name) => {
              const property = schema.properties[name];
              return `  ${name}: ${printSchema(property)},`;
            })
            .join("\n")
        ) +
        "}"
      );
    case "error":
      console.log(schema);
      return "error! " + schema.extra;
    case "union":
    case "intersection":
      invariant("items" in schema);
      const separator = schema.kind === "union" ? "\n  | " : "\n  & ";
      return `
  | ${printString(schema.items.map(printSchema).sort().join(separator))}`;
    default:
      const gottaCatchEmAll: never = schema;
      throw new Error(`Unsupported schema kind ${(schema as any).kind}`);
  }
}
