import { defineSymbol } from "@symbolism/definitions";
import { getSymbolDeclaration } from "@symbolism/ts-utils";
import ts from "typescript";
import { AnySchemaNode } from "../schema";
import { convertTemplateLiteralValue } from "./string-template";

export function narrowTypeFromValues(
  type: ts.Type,
  contextNode: ts.Node,
  checker: ts.TypeChecker,
  typesHandled: Set<ts.Type>
): AnySchemaNode | undefined {
  const symbol = type.getSymbol();
  const symbolDeclaration = getSymbolDeclaration(symbol);

  if (symbolDeclaration) {
    const symbolSchema = convertValueDeclaration(
      symbolDeclaration,
      checker,
      typesHandled
    );
    if (symbolSchema) {
      return symbolSchema;
    }
  }

  if (contextNode) {
    // If we are using the context node, we will need to resolve where it lives.
    const contextDefinition = defineSymbol(contextNode, checker);
    if (contextDefinition?.declaration) {
      const contextSchema = convertValueDeclaration(
        contextDefinition?.declaration,
        checker,
        typesHandled
      );
      if (contextSchema) {
        return contextSchema;
      }
    }
  }
}

export function convertValueDeclaration(
  node: ts.Declaration,
  checker: ts.TypeChecker,
  typesHandled: Set<ts.Type>
): AnySchemaNode | undefined {
  if (
    ts.isVariableDeclaration(node) ||
    ts.isParameter(node) ||
    ts.isBindingElement(node) ||
    ts.isPropertySignature(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isPropertyAssignment(node)
  ) {
    // TODO: This will need some sort of generic expression static type analysis
    if (node.initializer && ts.isTemplateExpression(node.initializer)) {
      return convertTemplateLiteralValue(
        node.initializer,
        checker,
        typesHandled
      );
    }
  }
  if (ts.isTypeAliasDeclaration(node)) {
    const secondDefinition = defineSymbol(node.type, checker);
    const secondDeclaration = getSymbolDeclaration(secondDefinition?.symbol);

    if (secondDeclaration) {
      return convertValueDeclaration(secondDeclaration, checker, typesHandled);
    }
  }
}
