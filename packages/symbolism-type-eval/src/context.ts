import ts from "typescript";
import { getSymbolDeclaration } from "@symbolism/ts-utils";
import { FunctionCallInfo } from "./calls";
import { SymbolTable } from "@symbolism/symbol-table";
import invariant from "tiny-invariant";

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
    this.cloneProps(ret);

    return [type, ret] as const;
  }

  cloneNode<T extends ts.Node>(node: T) {
    const ret = new SchemaContext(node, this.checker);
    this.cloneProps(ret);

    return [node, ret] as const;
  }

  constructor(contextNode: ts.Node, checker: ts.TypeChecker) {
    this.contextNode = contextNode;
    this.checker = checker;
    this.typesHandled = new Set<ts.Type>();
  }

  protected cloneProps(newInstance: SchemaContext) {
    newInstance.typesHandled = new Set<ts.Type>(this.typesHandled);
  }
}

export class CallContext extends SchemaContext {
  callCache = new Map<ts.Node, FunctionCallInfo[]>();
  symbols: SymbolTable;

  constructor(
    symbol: ts.Symbol,
    symbols: SymbolTable,
    checker: ts.TypeChecker
  ) {
    const declaration = getSymbolDeclaration(symbol);
    invariant(declaration, "Symbol has no declaration");

    super(declaration, checker);
    this.symbols = symbols;
  }

  protected override cloneProps(newInstance: CallContext) {
    super.cloneProps(newInstance);
    newInstance.callCache = new Map(this.callCache);
    newInstance.symbols = this.symbols;
  }
}
