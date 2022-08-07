import ts from "typescript";
import { getSymbolDeclaration } from "@symbolism/ts-utils";

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
