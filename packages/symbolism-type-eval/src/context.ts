import ts from "typescript";
import { getSymbolDeclaration } from "@symbolism/ts-utils";
import { FunctionCallInfo } from "./calls";
import { SymbolTable } from "@symbolism/symbol-table";
import invariant from "tiny-invariant";
import { TypeEvalOptions } from "./value-eval";
import { AnySchemaNode } from "./schema";

export class SchemaContext {
  typesHandled = new Set<ts.Type>();

  typeDefinitions = new Map<string, AnySchemaNode>();

  narrowingNode?: ts.Node;

  constructor(
    public contextNode: ts.Node,
    public checker: ts.TypeChecker,
    public options: TypeEvalOptions
  ) {}

  clone(
    type: ts.Type,
    node?: ts.Node,
    options?: TypeEvalOptions
  ): [ts.Type, SchemaContext];
  clone(
    type: undefined,
    node: ts.Node,
    options?: TypeEvalOptions
  ): [ts.Type, SchemaContext];
  clone(
    type?: ts.Type,
    node: ts.Node = findContextNode(type!, this.contextNode),
    options = this.options
  ) {
    if (!type) {
      type = this.checker.getTypeAtLocation(node);
    }

    const ret = new SchemaContext(node, this.checker, options);
    this.cloneProps(ret);

    return [type, ret] as const;
  }

  cloneNode<T extends ts.Node>(node: T, options = this.options) {
    const ret = new SchemaContext(node, this.checker, options);
    this.cloneProps(ret);

    return [node, ret] as const;
  }

  protected cloneProps(newInstance: SchemaContext) {
    newInstance.typesHandled = new Set(this.typesHandled);
    newInstance.narrowingNode = this.narrowingNode;
    newInstance.typeDefinitions = this.typeDefinitions;
  }
}

export class CallContext extends SchemaContext {
  callCache = new Map<ts.Node, FunctionCallInfo[]>();
  symbolsHandled: ts.Symbol[] = [];

  constructor(
    symbol: ts.Symbol,
    public symbols: SymbolTable,
    checker: ts.TypeChecker,
    options: TypeEvalOptions
  ) {
    invariant(symbol, "symbol must be defined");

    const declaration = getSymbolDeclaration(symbol);
    if (!declaration) {
      throw new Error(`Unable to find declaration for symbol ${symbol.name}`);
    }

    super(declaration, checker, options);
  }

  cloneSymbol(symbol: ts.Symbol) {
    const ret = new CallContext(
      symbol,
      this.symbols,
      this.checker,
      this.options
    );
    this.cloneProps(ret);

    ret.symbolsHandled.push(symbol);

    return [symbol, ret] as const;
  }

  protected override cloneProps(newInstance: CallContext) {
    super.cloneProps(newInstance);
    newInstance.callCache = new Map(this.callCache);
    newInstance.symbols = this.symbols;
    newInstance.symbolsHandled = this.symbolsHandled.slice();
  }
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
