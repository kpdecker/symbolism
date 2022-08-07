import ts, { findAncestor } from "typescript";

import { SymbolTable } from "@symbolism/symbol-table";
import { AnySchemaNode, convertTSTypeToSchema } from "../schema";
import { CallContext, SchemaContext } from "../context";
import { dumpNode, dumpSymbol } from "@symbolism/ts-debug";
import { areSchemasEqual, nonConcreteInputs } from "../classify";
import { resolveSymbolsInSchema } from "../value-eval/symbol";
import { defineSymbol } from "@symbolism/definitions";
import { NodeError, removeDuplicates } from "@symbolism/utils";

export type FunctionCallInfo = {
  callExpression: ts.CallExpression;
  arguments: AnySchemaNode[];
  symbols: ts.Symbol[];
};

export function loadFunctionCalls(
  symbol: ts.Symbol,
  context: CallContext
): FunctionCallInfo[] {
  const functionCalls = convertFunctionCalls(symbol, context);

  // TODO: Flatten binary expressions, etc
  return functionCalls;
}
function convertFunctionCalls(
  symbol: ts.Symbol,
  context: CallContext
): FunctionCallInfo[] {
  const { symbols } = context;

  const referenceSet = symbols.get(symbol);
  const references = referenceSet && Array.from(referenceSet);

  const calls = (references?.map((reference) => reference.parent) ?? []).filter(
    ts.isCallExpression
  );

  const collectedCalls: FunctionCallInfo[] = [];

  calls.forEach((callExpression) => {
    try {
      convertCall(callExpression, context, collectedCalls);
    } catch (e: any) {
      throw new NodeError(
        "Error converting call",
        callExpression,
        context.checker,
        e
      );
    }
  });

  return removeDuplicates(collectedCalls, (a, b) => {
    return areSchemasEqual(a.arguments, b.arguments);
  });
}

function convertCall(
  callExpression: ts.CallExpression,
  context: CallContext,
  collectedCalls: FunctionCallInfo[]
): FunctionCallInfo | undefined {
  const { checker } = context;

  const signature = checker.getResolvedSignature(callExpression)!;
  const parameterSymbols = signature.getParameters();

  const argSchemas = callExpression.arguments.map((argument, i) => {
    const schema = convertTSTypeToSchema(...context.clone(undefined, argument));

    const inputs = nonConcreteInputs(schema);
    const inputSymbols = inputs.map((input) =>
      defineSymbol(input, context.checker)
    );

    return {
      schema,
      inputs,
      inputSymbols,
    };
  });

  const identitySchema = {
    callExpression,
    arguments: argSchemas.map((arg) => arg.schema),
    symbols: parameterSymbols,
  };

  // Everything is concrete. No need to expand.
  if (argSchemas.every((arg) => !arg.inputs.length)) {
    collectedCalls.push(identitySchema);
    return;
  }

  // Find the inputs that are parameter calls
  const parameterInputs = new Set(
    argSchemas.flatMap((arg) => {
      const parameterNodes: ts.ParameterDeclaration[] = arg.inputSymbols
        .map((node) => findAncestor(node?.declaration, ts.isParameter)!)
        .filter(Boolean);
      return parameterNodes;
    })
  );

  const functionDeclarations = Array.from(
    new Set(Array.from(parameterInputs.values()).map((node) => node.parent))
  ).sort((a, b) => a.pos - b.pos);

  // If there are no parameters, then report the call as a concrete call.
  if (!functionDeclarations.length) {
    collectedCalls.push(identitySchema);
    return;
  }

  // We have parameters that need to be resolved via upstream calls.
  const upstreamCalls = new Map<ts.SignatureDeclaration, FunctionCallInfo[]>();
  functionDeclarations.forEach((declaration) => {
    const upstreamCall = convertFunctionCalls(
      checker.getSymbolAtLocation(declaration.name || declaration.parent)!,
      context
    );
    upstreamCalls.set(declaration, upstreamCall);
  });

  if (!functionDeclarations.length) {
    // No calls, emit the abstract schema
    collectedCalls.push(identitySchema);
    return;
  }

  let partiallyResolvedArgSchemas: AnySchemaNode[][] = [];

  // Outer call should always be bound
  const firstDeclaration = functionDeclarations.shift()!;
  {
    const upstreamCall = upstreamCalls.get(firstDeclaration);
    upstreamCall?.forEach((call) => {
      // Inject the arguments into the call
      const symbolMap = new Map<ts.Symbol, AnySchemaNode>();
      parameterInputs.forEach((node) => {
        if (node.parent === firstDeclaration) {
          const symbol = checker.getSymbolAtLocation(node.name)!;
          const parameterIndex = node.parent.parameters.indexOf(node);

          symbolMap.set(symbol, call.arguments[parameterIndex]);
        }
      });
      partiallyResolvedArgSchemas.push(
        argSchemas.map((arg) =>
          resolveSymbolsInSchema(arg.schema, symbolMap, checker)
        )
      );
    });
  }

  if (functionDeclarations.length) {
    // TODO: Currying. Figure this out. We will have to differentiate between
    // multiple invocations of the outer function, to ensure proper parameter
    // matching on the inner.
    // TODO: Figure out how to record where this return was used
    console.log(
      "multiple declarations",
      dumpNode(firstDeclaration, checker),
      ...functionDeclarations.map((declaration) =>
        dumpNode(declaration, checker)
      )
    );
  }

  partiallyResolvedArgSchemas.forEach((argSchemas) => {
    callExpression.parent;
    collectedCalls.push({
      callExpression,
      arguments: argSchemas,
      symbols: parameterSymbols,
    });
  });
}
