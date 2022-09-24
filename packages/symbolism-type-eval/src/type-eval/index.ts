import {
  dumpFlags,
  dumpNode,
  dumpSchema,
  dumpSymbol,
  dumpType,
} from "@symbolism/ts-debug";
import {
  getSymbolDeclaration,
  getTypeId,
  getTypeName,
  invariantNode,
  isIntrinsicType,
  isNamedType,
  isThisTypeParameter,
  isTupleTypeReference,
} from "@symbolism/ts-utils";
import {
  assertUnreachable,
  logDebug,
  NodeError,
} from "@symbolism/utils";
import invariant from "tiny-invariant";
import ts from "typescript";
import { SchemaContext } from "../context";
import {
  AnySchemaNode,
  createReferenceSchema,
  ErrorSchema,
  FunctionSchema,
  PrimitiveSchema,
} from "../schema";
import { getNodeSchema, TypeEvalOptions } from "../value-eval";
import { createUnionKind } from "../value-eval/union";
import {
  neverSchema,
  tooMuchRecursionSchema,
  wellKnownReferences,
} from "../well-known-schemas";
import { convertLiteralOrPrimitive } from "./literal";
import { convertObjectType } from "./object";
import { convertTemplateLiteralType } from "./template-literal";

export const buildingSchema: ErrorSchema = {
  kind: "error",
  extra: "building",
};

export function getTypeSchema(
  params: {
    type?: ts.Type;
    node: ts.Node;
    context: SchemaContext;
    decrementDepth: boolean;
  } & TypeEvalOptions
): AnySchemaNode;
export function getTypeSchema(
  params: {
    type: ts.Type;
    node?: ts.Node;
    context: SchemaContext;
    decrementDepth: boolean;
  } & TypeEvalOptions
): AnySchemaNode;
export function getTypeSchema(
  params: {
    type?: ts.Type;
    node?: ts.Node;
    context: SchemaContext;
    decrementDepth: boolean;
  } & TypeEvalOptions
): AnySchemaNode {
  let { type, node } = params;

  if (!node) {
    node = findContextNode(type!, params.context.contextNode);
  }
  if (!type) {
    type = params.context.checker.getTypeAtLocation(node);
  }

  if (ts.isParameter(node) && params.context.parameterBindings.has(node)) {
    return params.context.parameterBindings.get(node)!;
  }

  const context = params.context.clone({
    ...params,
    type,
    node,
  });
  const { contextNode, checker, typesHandled } = context;

  if (context.maxDepth <= 0) {
    return tooMuchRecursionSchema;
  }

  if (isThisTypeParameter(type)) {
    // Resolve the class rather than this type
    type = type.getConstraint() || type;
  }

  const canEmitDef = isNamedType(type, checker);

  const typeId = getTypeId(type, checker, true);
  const typeName = getTypeName(type, checker);
  const existingDef = typeId && context.typeDefinitions.get(typeId);

  // Use type reference if we've processed this already.
  if (wellKnownReferences.includes(typeName!) || (canEmitDef && existingDef)) {
    const refSchema = createReferenceFromType(type, context);
    if (refSchema) {
      return refSchema;
    }
  }

  if (!canEmitDef && context.typeCache.has(type)) {
    return context.typeCache.get(type)!;
  }

  if (!isIntrinsicType(type)) {
    typesHandled.add(type);
  }

  logDebug(
    "getTypeSchema",
    () => dumpType(type, checker),
    () => dumpNode(contextNode, checker),
    { canEmitDef, typeId, typeName }
  );

  if (canEmitDef) {
    context.typeDefinitions.set(typeId, buildingSchema);
  }

  const ret = getTypeSchemaWorker(type, context);
  if (canEmitDef && ret.kind !== "reference") {
    if (existingDef && existingDef !== buildingSchema) {
      throw new NodeError(
        `Duplicate definition for symbol ${JSON.stringify(
          dumpSymbol(type.symbol, checker),
          undefined,
          2
        )}

New: ${dumpSchema(ret)}
Existing: ${dumpSchema(
          typeof existingDef === "function" ? existingDef() : existingDef
        )})}`,
        contextNode,
        checker
      );
    }
    context.typeDefinitions.set(typeId, ret);
  }

  // Cache if we are dealing with an instantiated type.
  // Caching the results of primitives, etc can result in incorrect
  // mappings due to contextNode varying for the intrinsic singletons.
  if (!isIntrinsicType(type)) {
    context.typeCache.set(type, ret);
  }

  return ret;
}
function getTypeSchemaWorker(
  type: ts.Type,
  context: SchemaContext
): AnySchemaNode {
  const { contextNode, checker } = context;
  try {
    if (type.flags & ts.TypeFlags.TypeParameter) {
      return getTypeSchema({
        context,
        type: checker.getApparentType(type),
        decrementDepth: false,
      });
    }

    const objectFlags = (type as ts.ObjectType).objectFlags;

    const literalOrPrimitive =
      convertLiteralOrPrimitive(type, context) ||
      convertTemplateLiteralType(type, context);
    if (literalOrPrimitive) {
      return literalOrPrimitive;
    }

    if (type.isUnion()) {
      const items = type.types.map((t) =>
        getTypeSchema({
          context,
          type: t,
          decrementDepth: true,
        })
      );
      return createUnionKind(items);
    } else if (type.isIntersection()) {
      let allObjects = true;
      const items = type.types.map((t) => {
        if (t.isLiteral()) {
          allObjects = false;
          return getTypeSchema({
            context,
            type: t,
            decrementDepth: true,
          });
        }

        const apparentType = checker.getApparentType(t);
        if (
          !(t.flags & ts.TypeFlags.Object) ||
          !(apparentType.flags & ts.TypeFlags.Object)
        ) {
          allObjects = false;
        }
        const ret = getTypeSchema({
          context,
          type: apparentType,
          decrementDepth: true,
        });
        if (ret.kind !== "object" && ret.kind !== "reference") {
          allObjects = false;
        }

        return ret;
      });

      // If we consist of objects only, then merge we can merge them
      if (allObjects) {
        return convertObjectType(context, type);
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
        getTypeSchema({
          context,
          type: elementType,
          decrementDepth: true,
        })
      );

      return {
        kind: "tuple",
        items,
        elementFlags: tupleType.elementFlags,
      };
    } else if ((checker as any).isArrayType(type)) {
      if (ts.isArrayLiteralExpression(contextNode)) {
        return getNodeSchema({
          context,
          node: contextNode,
          decrementDepth: false,
          allowMissing: false,
        })!;
      }
      const arrayValueType = checker.getIndexTypeOfType(
        type,
        ts.IndexKind.Number
      );
      invariant(arrayValueType, "Array type has no number index type");

      const items = getTypeSchema({
        context,
        type: arrayValueType,
        decrementDepth: false,
      });
      return {
        kind: "array",
        items,
        node: contextNode,
      };
    } else if (type.flags & ts.TypeFlags.Object || type.isClassOrInterface()) {
      const objectFlags = (type as ts.ObjectType).objectFlags;

      // If we have an object literal, then perform static analysis on the
      // runtime code to refine further than the default checker evaluation.
      if (objectFlags & ts.ObjectFlags.ObjectLiteral) {
        const declaration = getSymbolDeclaration(type.symbol);
        if (declaration) {
          invariantNode(declaration, checker, ts.isObjectLiteralExpression);
          const valueSchema = getNodeSchema({
            context,
            node: declaration,
            decrementDepth: false,
            allowMissing: true,
          });
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
                schema: context.options.evalParameters
                  ? getNodeSchema({
                      context,
                      node: declaration,
                      decrementDepth: true,
                      allowMissing: false,
                    })!
                  : ({
                      kind: "primitive",
                      name: "unknown",
                      node: declaration,
                    } as PrimitiveSchema),
                symbol: parameter,
              };
            }),
            returnType: getTypeSchema({
              context,
              type: returnType,
              decrementDepth: true,
            }),
          };
        }

        const buildFunctionSchema = () =>
          createUnionKind(callSignatures.map(convertSignature));

        if (isNamedType(type, context.checker)) {
          const referenceNode = createReferenceFromType(
            type,
            context,
            buildFunctionSchema
          );
          if (referenceNode) {
            return referenceNode;
          }
        }

        return buildFunctionSchema();
      }

      const buildObjectSchema = () => convertObjectType(context, type);
      if (isNamedType(type, context.checker)) {
        const referenceNode = createReferenceFromType(
          type,
          context,
          buildObjectSchema
        );
        if (referenceNode) {
          return referenceNode;
        }
      }

      return buildObjectSchema();
    } else if (type.flags & ts.TypeFlags.Index) {
      const index = type as ts.IndexType;
      const node = findContextNode(index.type, context.contextNode);

      return {
        kind: "index",
        type: getTypeSchema({
          context,
          type: index.type,
          node,
          decrementDepth: true,
        }),
        node,
      };
    } else if (type.flags & ts.TypeFlags.IndexedAccess) {
      const indexAccess = type as ts.IndexedAccessType;
      return {
        kind: "index-access",
        object: getTypeSchema({
          context,
          type: indexAccess.objectType,
          decrementDepth: false,
        }),
        index: getTypeSchema({
          context,
          type: indexAccess.indexType,
          decrementDepth: false,
        }),
        node: contextNode,
      };
    } else if (type.flags & ts.TypeFlags.Conditional) {
      return {
        kind: "error",
        extra: "Conditional type not supported in schemas",
      };
    } else if (type.flags & ts.TypeFlags.StringMapping) {
      const childType = (type as ts.StringMappingType).type;
      const childSchema = getTypeSchema({
        context,
        type: childType,
        decrementDepth: false,
      });

      return mapString(childSchema, type as ts.StringMappingType, context);
    } else {
      /* istanbul ignore next Sanity */
      throw new Error(
        `Unsupported type ${JSON.stringify(dumpType(type, checker))}`
      );
    }
  } catch (err: any) {
    throw new NodeError(
      `Error converting type ${checker.typeToString(type)} ${context.history}`,
      contextNode,
      checker,
      err
    );
  }
}

export function mapString(
  schema: AnySchemaNode,
  mappingType: ts.StringMappingType,
  context: SchemaContext
): AnySchemaNode {
  if (!schema) {
    return schema;
  }

  if (
    schema.kind === "primitive" ||
    schema.kind === "error" ||
    // Type checker would have resolved this if it was concrete.
    schema.kind === "index" ||
    schema.kind === "index-access"
  ) {
    return schema;
  }

  const operator: "Uppercase" | "Lowercase" | "Capitalize" | "Uncapitalize" =
    mappingType.symbol.name as any;

  if (schema.kind === "literal") {
    if (typeof schema.value === "string") {
      const str = schema.value;
      let newValue = schema.value;

      switch (operator) {
        case "Uppercase":
          newValue = str.toUpperCase();
          break;
        case "Lowercase":
          newValue = str.toLowerCase();
          break;
        case "Capitalize":
          newValue = str.charAt(0).toUpperCase() + str.slice(1);
          break;
        case "Uncapitalize":
          newValue = str.charAt(0).toLowerCase() + str.slice(1);
          break;
      }

      return {
        kind: "literal",
        value: newValue,
      };
    } else {
      return neverSchema;
    }
  }

  if (schema.kind === "template-literal") {
    const operatesOnWholeString =
      operator === "Lowercase" || operator === "Uppercase";

    return {
      kind: "template-literal",
      items: schema.items.map((item, i) =>
        i < 1 || operatesOnWholeString
          ? mapString(item, mappingType, context)
          : item
      ),
    };
  }

  if (schema.kind === "reference") {
    // WARN: This could OOM if a cyclical object is passed. This doesn't match constraints
    // of the string mapping types so we're ignoring this case for now.
    return mapString(context.resolveSchema(schema), mappingType, context);
  }

  if (schema.kind === "binary-expression" || schema.kind === "function") {
    return {
      kind: "error",
      extra: schema.kind + " not supported in string mapping",
    };
  }

  if (schema.kind === "union") {
    return createUnionKind(
      schema.items.map((item) => mapString(item, mappingType, context))
    );
  } else if (schema.kind === "intersection" || schema.kind === "tuple") {
    return {
      ...schema,
      items: schema.items.map((item) => mapString(item, mappingType, context)),
    };
  }

  if (schema.kind === "array") {
    return {
      ...schema,
      items: mapString(schema.items, mappingType, context),
    };
  }

  if (schema.kind === "object") {
    return {
      ...schema,
      properties: Object.entries(schema.properties).reduce(
        (acc, [key, value]) => {
          acc[key] = mapString(value, mappingType, context);
          return acc;
        },
        {} as Record<string, AnySchemaNode>
      ),
    };
  }

  assertUnreachable(schema);
}

export function createReferenceFromType(
  type: ts.Type,
  context: SchemaContext,
  definitionSchema?: () => AnySchemaNode
): AnySchemaNode | undefined {
  const typeId = getTypeId(type, context.checker, true);
  const friendlyTypeId = getTypeId(type, context.checker, false);
  const typeName = getTypeName(type, context.checker);

  const aliasSymbol = type.aliasSymbol;
  const symbol = type.symbol?.name ? type.symbol : aliasSymbol;

  const typeArguments: readonly ts.Type[] =
    type.aliasTypeArguments || (type as any).resolvedTypeArguments || [];
  const parameters = typeArguments
    .map((type) => {
      if (!isThisTypeParameter(type)) {
        return getTypeSchema({ context, type, decrementDepth: true });
      }
      return undefined!;
    })
    .filter(Boolean);

  if (symbol?.name === "Array" && parameters[0]?.kind === "primitive") {
    return {
      kind: "array",
      items: parameters[0],
      node: parameters[0].node,
    };
  }

  if (definitionSchema) {
    context.typeDefinitions.set(typeId, definitionSchema);
  }

  if (!typeName) {
    return undefined;
  }
  return createReferenceSchema(typeName, parameters, typeId, friendlyTypeId);
}

function findContextNode(type: ts.Type, contextNode: ts.Node): ts.Node {
  if (type.symbol) {
    const declaration = getSymbolDeclaration(type.symbol);
    if (declaration) {
      return declaration;
    }
  }

  return contextNode;
}
