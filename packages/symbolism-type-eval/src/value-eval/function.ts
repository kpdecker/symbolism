import ts, { findAncestor } from "typescript";
import { findNodesInTree, invariantNode, TypeId } from "@symbolism/ts-utils";
import { checkerEval, nodeEvalHandler, noType } from "./handlers";
import { getNodeSchema } from ".";
import { undefinedSchema } from "../well-known-schemas";
import { SchemaContext } from "../context";
import { getTypeSchema } from "../type-eval";
import { createUnionKind } from "./union";
import { AnySchemaNode, createReferenceSchema } from "../schema";
import { SchemaError } from "../classify";
import { printSchemaNode } from "../print/typescript";

export const functionOperators = nodeEvalHandler({
  [ts.SyntaxKind.CallExpression]: convertCallLikeNode,
  [ts.SyntaxKind.NewExpression]: convertCallLikeNode,
  [ts.SyntaxKind.TaggedTemplateExpression]: convertCallLikeNode,

  [ts.SyntaxKind.ArrowFunction]: convertFunctionLikeNode,

  [ts.SyntaxKind.FunctionExpression]: convertFunctionLikeNode,
  [ts.SyntaxKind.FunctionDeclaration]: convertFunctionLikeNode,
  [ts.SyntaxKind.Parameter](node, context) {
    invariantNode(node, context.checker, ts.isParameter);
    if (context.options.limitToValues) {
      // Don't evaluate the type to allow for parameter replacement
      return {
        kind: "primitive",
        name: "any",
        node,
      };
    }
    return checkerEval(node, context);
  },

  [ts.SyntaxKind.Block]: noType,
  [ts.SyntaxKind.YieldExpression](node, context) {
    invariantNode(node, context.checker, ts.isYieldExpression);
    if (node.expression) {
      return getNodeSchema(
        ...context.cloneNode({
          node: node.expression,
          decrementDepth: false,
        })
      );
    }
  },
  [ts.SyntaxKind.ThrowStatement](node, context) {
    invariantNode(node, context.checker, ts.isThrowStatement);
    return getNodeSchema(
      ...context.cloneNode({
        node: node.expression,
        decrementDepth: false,
      })
    );
  },
  [ts.SyntaxKind.ReturnStatement](node, context) {
    invariantNode(node, context.checker, ts.isReturnStatement);
    if (node.expression) {
      return getNodeSchema(
        ...context.cloneNode({
          node: node.expression,
          decrementDepth: false,
        })
      );
    } else {
      return undefinedSchema;
    }
  },
  [ts.SyntaxKind.AwaitExpression](node, context): AnySchemaNode | undefined {
    invariantNode(node, context.checker, ts.isAwaitExpression);

    const expressionSchema = getNodeSchema(
      ...context.cloneNode({
        node: node.expression,
        decrementDepth: false,
      })
    );

    // Unwrap promises
    if (expressionSchema?.kind === "reference") {
      if (
        expressionSchema.name === "Promise" &&
        expressionSchema.parameters.length === 1
      ) {
        return context.resolveSchema(expressionSchema.parameters[0]);
      }
    }

    return context.resolveSchema(expressionSchema);
  },
});

function convertFunctionLikeNode(node: ts.Node, context: SchemaContext) {
  invariantNode(node, context.checker, ts.isFunctionLike);
  const evaledType = context.resolveSchema(checkerEval(node, context));

  if (evaledType?.kind !== "function") {
    return evaledType;
  }

  // Use the checker for generators until/if we can support the type parameters
  // directly.
  if ("asteriskToken" in node && node.asteriskToken) {
    return checkerEval(node, context);
  }

  let returnNodes: ts.Node[] = findNodesInTree(
    node,
    ts.isReturnStatement
  ).filter((returnNode) => {
    return findAncestor(returnNode, ts.isFunctionLike) === node;
  });
  if (
    ts.isArrowFunction(node) &&
    !ts.isBlock(node.body) &&
    !returnNodes.length
  ) {
    returnNodes = [node.body];
  }

  const asyncFunction = node.modifiers?.find(
    (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword
  );

  if (returnNodes.length === 0) {
    return evaledType;
  } else {
    let returnType: AnySchemaNode = createUnionKind(
      returnNodes.map((returnNode) => {
        return getNodeSchema(
          ...context.cloneNode({
            node: returnNode,
            decrementDepth: true,
            allowMissing: false,
          })
        )!;
      })
    );

    if (asyncFunction) {
      returnType = createReferenceSchema(
        "Promise",
        [returnType],
        `Promise<${printSchemaNode(returnType)}>` as TypeId
      );
    }

    return {
      ...evaledType,
      returnType,
    };
  }
}

function convertCallLikeNode(node: ts.Node, context: SchemaContext) {
  invariantNode(node, context.checker, ts.isCallLikeExpression);

  const signature = context.checker.getResolvedSignature(node);

  const returnType = signature?.getReturnType();

  // Evaluate the function at node level
  if (!ts.isNewExpression(node) && signature?.declaration) {
    const functionSchema = context.resolveSchema(
      getNodeSchema(
        ...context.cloneNode({
          node: signature?.declaration,
          decrementDepth: false,
        })
      )
    );

    let returnType: AnySchemaNode | undefined = undefined;
    if (functionSchema?.kind === "function") {
      returnType = functionSchema.returnType;
    } else if (functionSchema?.kind === "union") {
      returnType = createUnionKind(
        functionSchema.items
          .map((type) =>
            type.kind === "function" ? type.returnType : undefined!
          )
          .filter(Boolean)
      );
    }
    if (!returnType) {
      throw new SchemaError("Expected function schema", functionSchema);
    }
    return returnType;
  }

  if (returnType) {
    return getTypeSchema(
      ...context.clone({
        type: returnType,
        node,
        decrementDepth: false,
      })
    );
  }

  return undefinedSchema;
}
