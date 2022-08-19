import ts, { findAncestor } from "typescript";
import { findNodesInTree, invariantNode } from "@symbolism/ts-utils";
import { checkerEval, nodeEvalHandler, noType } from "./handlers";
import { getNodeSchema } from ".";
import { undefinedSchema } from "../well-known-schemas";
import { SchemaContext } from "../context";
import { getTypeSchema } from "../type-eval";
import { createUnionKind } from "./union";
import invariant from "tiny-invariant";
import { dumpNode } from "@symbolism/ts-debug";

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
      // Don't evaluate the type to allow for parameter replacemetn
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
      return getNodeSchema(node.expression, context);
    }
  },
  [ts.SyntaxKind.ReturnStatement](node, context) {
    invariantNode(node, context.checker, ts.isReturnStatement);
    if (node.expression) {
      return getNodeSchema(node.expression, context);
    } else {
      return undefinedSchema;
    }
  },
});

function convertFunctionLikeNode(node: ts.Node, context: SchemaContext) {
  invariantNode(node, context.checker, ts.isFunctionLike);
  const evaledType = checkerEval(node, context);
  invariant(evaledType?.kind === "function", "Expected function schema");

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

  if (returnNodes.length === 0) {
    return evaledType;
  } else {
    return {
      ...evaledType,
      returnType: createUnionKind(
        returnNodes.map((returnNode) => {
          return getNodeSchema(
            ...context.cloneNode(returnNode, {
              ...context.options,
              allowMissing: false,
            })
          )!;
        })
      ),
    };
  }
}

function convertCallLikeNode(node: ts.Node, context: SchemaContext) {
  invariantNode(node, context.checker, ts.isCallLikeExpression);
  const signature = context.checker.getResolvedSignature(node);
  const returnType = signature?.getReturnType();
  if (returnType) {
    return getTypeSchema(...context.clone(returnType, node));
  } else {
    return undefinedSchema;
  }
}
