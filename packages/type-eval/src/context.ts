import ts from "typescript";
import { getSymbolDeclaration, TypeId } from "@noom/symbolism-ts-utils";
import { FunctionCallInfo } from "./calls";
import { SymbolTable } from "@noom/symbolism-symbol-table";
import invariant from "tiny-invariant";
import { TypeEvalOptions } from "./value-eval";
import { AnySchemaNode } from "./schema";
import { baseDefs, wellKnownReferences } from "./well-known-schemas";
import { SchemaError } from "./classify";
import { buildingSchema } from "./type-eval";

export class SchemaContext {
  typesHandled = new Set<ts.Type>();
  typeDefinitions = new Map<TypeId, AnySchemaNode | (() => AnySchemaNode)>(
    baseDefs
  );

  /**
   * Cache of computed internal schemas. These types are generally
   * unnamed and not intended to be inlined vs. typeDefinitions that
   * are intended to be extracted to separate definitions.
   */
  typeCache = new Map<ts.Type, AnySchemaNode>();

  /**
   * Known parameter bindings.
   */
  parameterBindings = new Map<ts.ParameterDeclaration, AnySchemaNode>();

  // Arbitrary limit to prevent infinite loops
  maxDepth = 50;

  history = "";

  constructor(
    public contextNode: ts.Node,
    public checker: ts.TypeChecker,
    public options: TypeEvalOptions
  ) {}

  resolveSchema(schema: AnySchemaNode): AnySchemaNode;
  resolveSchema(schema: AnySchemaNode | undefined): AnySchemaNode | undefined;
  resolveSchema(schema: AnySchemaNode | undefined): AnySchemaNode | undefined {
    if (schema?.kind === "reference") {
      const definition = this.typeDefinitions.get(schema.typeId);
      if (definition === buildingSchema) {
        throw new SchemaError(
          `Circular reference to ${schema.typeId} while building schema ` +
            this.history,
          schema
        );
      }

      if (
        !definition &&
        !wellKnownReferences.includes(schema.name) &&
        schema.name !== "tooMuchRecursion"
      ) {
        throw new SchemaError("Definition not found ", schema);
      }
      if (definition) {
        if (typeof definition === "function") {
          this.typeDefinitions.set(schema.typeId, buildingSchema);
          const evaledDefinition = definition();
          this.typeDefinitions.set(schema.typeId, evaledDefinition);
          return evaledDefinition;
        }
        return definition;
      }

      return { kind: "primitive", name: "unknown" };
    }
    return schema;
  }

  clone(
    params: {
      type: ts.Type;
      node: ts.Node;
      decrementDepth: boolean;
    } & TypeEvalOptions
  ) {
    const { node, type, decrementDepth, ...rest } = params;

    const ret = new SchemaContext(node, this.checker, {
      ...this.options,
      ...rest,
    });
    this.cloneProps(ret);
    ret.history += `\n    -> ${
      ts.SyntaxKind[node.kind]
    } ${this.checker.typeToString(type)}`;

    if (decrementDepth) {
      ret.maxDepth--;
    }

    return ret;
  }

  cloneNode<T extends ts.Node>(
    params: {
      node: T;
      decrementDepth: boolean;
    } & TypeEvalOptions
  ) {
    const { node, decrementDepth, ...rest } = params;
    const ret = new SchemaContext(node, this.checker, {
      ...this.options,
      ...rest,
    });
    this.cloneProps(ret);
    ret.history += `\n    -> node ${
      ts.SyntaxKind[node.kind]
    } ${node.getText()}`;

    if (decrementDepth) {
      ret.maxDepth--;
    }

    return ret;
  }

  protected cloneProps(newInstance: SchemaContext) {
    newInstance.typesHandled = new Set(this.typesHandled);
    newInstance.parameterBindings = new Map(this.parameterBindings);
    newInstance.typeDefinitions = this.typeDefinitions;
    newInstance.typeCache = this.typeCache;
    newInstance.history = this.history;
    newInstance.maxDepth = this.maxDepth;
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
    ret.history += `\n    -> symbol ${symbol.name}`;

    return [symbol, ret] as const;
  }

  protected override cloneProps(newInstance: CallContext) {
    super.cloneProps(newInstance);
    newInstance.callCache = new Map(this.callCache);
    newInstance.symbols = this.symbols;
    newInstance.symbolsHandled = this.symbolsHandled.slice();
  }
}
