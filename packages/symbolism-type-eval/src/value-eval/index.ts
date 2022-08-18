import { defineSymbol } from "@symbolism/definitions";
import { getSymbolDeclaration, isIntrinsicType } from "@symbolism/ts-utils";
import { logDebug, logInfo, logWarn, NodeError } from "@symbolism/utils";
import ts from "typescript";
import { AnySchemaNode, convertTSTypeToSchema } from "../schema";
import { SchemaContext } from "../context";
import { convertBinaryExpression } from "./binary-expression";
import {
  convertElementAccessExpression,
  convertObjectLiteralValue,
} from "./object";
import { convertTemplateLiteralValue } from "./string-template";
import { convertArrayLiteralValue } from "./array";
import { dumpNode, dumpSchema } from "@symbolism/ts-debug";
import { areSchemasEqual } from "../classify";

export type TypeEvalOptions = {
  allowMissing?: boolean;
  includeTypeNodes?: boolean;
};

export function narrowTypeFromValues(
  type: ts.Type,
  context: SchemaContext
): AnySchemaNode | undefined {
  const { contextNode, checker } = context;

  const symbol = type.getSymbol();
  const symbolDeclaration = getSymbolDeclaration(symbol);

  // No narrowing to be done on type nodes, just use the checker evaluation.
  if (symbolDeclaration && ts.isTypeNode(symbolDeclaration)) {
    return undefined;
  }

  if (context.narrowingNode === contextNode) {
    throw new NodeError(
      "Circular narrowing node " + checker.typeToString(type),
      contextNode,
      checker
    );
  }

  // Create a new context to create a new circular reference check scope.
  // This allows for independent resolution of these distinct types. The
  // narrowingNode check ensures that we don't infinitely recurse.
  const newContext = new SchemaContext(
    contextNode,
    context.checker,
    context.options
  );
  newContext.narrowingNode = contextNode;

  if (symbolDeclaration) {
    const symbolSchema = convertValueDeclaration(
      ...newContext.cloneNode(symbolDeclaration, { allowMissing: true })
    );
    if (symbolSchema) {
      return symbolSchema;
    }
  }

  if (contextNode) {
    // If we are using the context node, we will need to resolve where it lives.
    const contextDefinition = defineSymbol(contextNode, checker, {
      chooseLocal: false,
    });
    if (contextDefinition?.declaration) {
      const contextSchema = convertValueDeclaration(
        ...newContext.cloneNode(contextDefinition.declaration, {
          allowMissing: true,
        })
      );
      if (contextSchema) {
        return contextSchema;
      }
    }

    const contextSchema = convertValueExpression(
      ...newContext.cloneNode(contextNode as ts.Expression, {
        allowMissing: true,
      })
    );
    if (contextSchema) {
      return contextSchema;
    }
  }
}

export function convertValueDeclaration(
  node: ts.Declaration,
  context: SchemaContext
): AnySchemaNode | undefined {
  try {
    if (
      ts.isVariableDeclaration(node) ||
      ts.isParameter(node) ||
      ts.isBindingElement(node) ||
      ts.isPropertySignature(node) ||
      ts.isPropertyDeclaration(node) ||
      ts.isPropertyAssignment(node)
    ) {
      if (node.initializer) {
        return convertValueExpression(...context.cloneNode(node.initializer));
      }
      if (context.options.includeTypeNodes && "type" in node && node.type) {
        return convertTSTypeToSchema(...context.clone(undefined, node.type));
      }
    }
    if (ts.isExpressionStatement(node)) {
      return convertValueExpression(...context.cloneNode(node.expression));
    }
    if (ts.isTypeAliasDeclaration(node)) {
      const secondDefinition = defineSymbol(node.type, context.checker, {
        chooseLocal: false,
      });
      const secondDeclaration = getSymbolDeclaration(secondDefinition?.symbol);

      if (secondDeclaration) {
        return convertValueDeclaration(...context.cloneNode(secondDeclaration));
      }
    }
  } catch (err: any) {
    throw new NodeError(
      "Failed to convert value declaration",
      node,
      context.checker,
      err
    );
  }
}

export function convertValueExpression(
  node: ts.Node,
  context: SchemaContext
): AnySchemaNode | undefined {
  try {
    const { checker } = context;

    if (ts.isParenthesizedExpression(node)) {
      return convertValueExpression(...context.cloneNode(node.expression));
    }

    if (ts.isIdentifier(node)) {
      const identifierDefinition = defineSymbol(node, checker, {
        chooseLocal: false,
      });

      if (isIntrinsicType(identifierDefinition?.type)) {
        const { type } = identifierDefinition!;
        if (type?.flags! & ts.TypeFlags.Undefined) {
          return {
            kind: "literal",
            value: undefined,
          };
        } else if (type?.flags! & ts.TypeFlags.Null) {
          return {
            kind: "literal",
            value: null,
          };
        }
      }

      const identifierDeclaration = getSymbolDeclaration(
        identifierDefinition?.symbol
      );

      if (identifierDeclaration) {
        return convertValueDeclaration(
          ...context.cloneNode(identifierDeclaration)
        );
      }

      return {
        kind: "primitive",
        name: "any",
        node,
      };
    }

    if (
      ts.isLiteralExpression(node) ||
      [
        ts.SyntaxKind.TrueKeyword,
        ts.SyntaxKind.FalseKeyword,
        ts.SyntaxKind.NullKeyword,
        ts.SyntaxKind.UndefinedKeyword,
        ts.SyntaxKind.VoidKeyword,
      ].includes(node.kind)
    ) {
      return convertNode(node, context);
    }

    if (ts.isTemplateExpression(node)) {
      return convertTemplateLiteralValue(node, context);
    }

    if (ts.isBinaryExpression(node)) {
      return convertBinaryExpression(node, context);
    }

    if (ts.isObjectLiteralExpression(node)) {
      return convertObjectLiteralValue(node, context);
    }

    if (ts.isComputedPropertyName(node)) {
      return convertValueExpression(...context.cloneNode(node.expression));
    }

    if (ts.isElementAccessExpression(node)) {
      return convertElementAccessExpression(node, context);
    }

    if (ts.isArrayLiteralExpression(node)) {
      return convertArrayLiteralValue(node, context);
    }

    if (!context.options.allowMissing) {
      throw new Error(`Unsupported expression: ${ts.SyntaxKind[node.kind]}`);
    } else {
      logDebug(
        `Unsupported expression: ${
          ts.SyntaxKind[node.kind]
        }\n\nNode: ${JSON.stringify(dumpNode(node, checker))}`
      );
    }
  } catch (err: any) {
    throw new NodeError(
      "Failed to convert value expression",
      node,
      context.checker,
      err
    );
  }
}

export function convertNode(node: ts.Node, context: SchemaContext) {
  const { checker } = context;

  const definition = defineSymbol(node, checker, { chooseLocal: false });

  if (definition?.declaration && definition?.type) {
    const schema = convertTSTypeToSchema(
      ...context.clone(definition.type, definition.declaration)
    );

    // We want to evaluate the type against the declaration, but we want the
    // schema to reference the usage to allow for replacement on call evaluation.
    if ("node" in schema) {
      return {
        ...schema,
        node,
      };
    }

    return schema;
  }

  return convertTSTypeToSchema(...context.clone(undefined, node));
}
