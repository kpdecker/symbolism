import { dumpFlags, dumpNode, dumpSymbol } from "@symbolism/ts-debug";
import {
  getSymbolDeclaration,
  invariantNode,
  isIntrinsicType,
  isTupleTypeReference,
} from "@symbolism/ts-utils";
import { logDebug, NodeError } from "@symbolism/utils";
import invariant from "tiny-invariant";
import ts from "typescript";
import { SchemaContext } from "../context";
import { AnySchemaNode, FunctionSchema } from "../schema";
import { getNodeSchema } from "../value-eval";
import { createUnionKind } from "../value-eval/union";
import { wellKnownReferences } from "../well-known-schemas";
import { convertLiteralOrPrimitive } from "./literal";
import { convertObjectType } from "./object";
import { convertTemplateLiteralType } from "./template-literal";

export function getTypeSchema(
  type: ts.Type,
  context: SchemaContext
): AnySchemaNode {
  const { contextNode, checker, typesHandled } = context;

  logDebug(
    "getTypeSchema",
    checker.typeToString(type),
    dumpNode(contextNode, checker)
  );

  try {
    if (type.flags & ts.TypeFlags.TypeParameter) {
      type = checker.getApparentType(type);
    }

    if (!isIntrinsicType(type) && typesHandled.has(type)) {
      return {
        kind: "error",
        extra: "Circular type " + checker.typeToString(type),
        node: contextNode,
      };
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
      const items = type.types.map((t) => getTypeSchema(...context.clone(t)));
      return createUnionKind(items);
    } else if (type.isIntersection()) {
      let allObjects = true;
      const items = type.types.map((t) => {
        if (t.isLiteral()) {
          allObjects = false;
          return getTypeSchema(...context.clone(t));
        }

        const apparentType = checker.getApparentType(t);
        if (
          !(t.flags & ts.TypeFlags.Object) ||
          !(apparentType.flags & ts.TypeFlags.Object)
        ) {
          allObjects = false;
        }
        return getTypeSchema(...context.clone(apparentType));
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
        getTypeSchema(...context.clone(elementType))
      );

      return {
        kind: "tuple",
        items,
        elementFlags: tupleType.elementFlags,
      };
    } else if ((checker as any).isArrayType(type)) {
      if (ts.isArrayLiteralExpression(contextNode)) {
        return getNodeSchema(
          ...context.cloneNode(contextNode, {
            allowMissing: false,
          })
        )!;
      }
      const arrayValueType = checker.getIndexTypeOfType(
        type,
        ts.IndexKind.Number
      );
      invariant(arrayValueType, "Array type has no number index type");

      return {
        kind: "array",
        items: getTypeSchema(...context.clone(arrayValueType)),
        flags: dumpFlags(type.flags, ts.TypeFlags).concat(
          dumpFlags(objectFlags, ts.ObjectFlags)
        ),
      };
    } else if (type.flags & ts.TypeFlags.Object || type.isClassOrInterface()) {
      const objectFlags = (type as ts.ObjectType).objectFlags;

      // If we have an object literal, then perform static analysis on the
      // runtime code to refine further than the default checker evaluation.
      if (objectFlags & ts.ObjectFlags.ObjectLiteral) {
        const declaration = getSymbolDeclaration(type.symbol);
        if (declaration) {
          invariantNode(declaration, checker, ts.isObjectLiteralExpression);
          const valueSchema = getNodeSchema(
            ...context.cloneNode(declaration, { allowMissing: true })
          );
          if (valueSchema) {
            return valueSchema;
          }
        }
      }

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
                schema: getNodeSchema(
                  ...context.cloneNode(declaration, {
                    allowMissing: false,
                  })
                )!,
                symbol: parameter,
              };
            }),
            returnType: getTypeSchema(...context.clone(returnType)),
          };
        }

        return createUnionKind(callSignatures.map(convertSignature));
      }

      const declaration = getSymbolDeclaration(type.symbol);
      if (declaration) {
        // Simplify library types to references
        // TODO: Create a proper reference schema type
        if (declaration.getSourceFile().fileName.includes("typescript/lib")) {
          const name = type.symbol.getName();

          if (
            wellKnownReferences.includes(name) &&
            !Object.values(ts.InternalSymbolName).includes(name as any)
          ) {
            return {
              kind: "reference",
              name,
            };
          }
        }
      }

      return convertObjectType(...context.clone(type));
    } else if (type.flags & ts.TypeFlags.Index) {
      const index = type as ts.IndexType;
      const clone = context.clone(index.type);

      return {
        kind: "index",
        type: getTypeSchema(...clone),
        node: clone[1].contextNode,
      };
    } else if (type.flags & ts.TypeFlags.IndexedAccess) {
      const indexAccess = type as ts.IndexedAccessType;
      return {
        kind: "index-access",
        object: getTypeSchema(...context.clone(indexAccess.objectType)),
        index: getTypeSchema(...context.clone(indexAccess.indexType)),
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
  } catch (err: any) {
    throw new NodeError(
      `Error converting type ${checker.typeToString(type)}`,
      contextNode,
      checker,
      err
    );
  }
}
