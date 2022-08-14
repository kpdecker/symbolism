import ts, { CallExpression, findAncestor } from "typescript";

import { AnySchemaNode, convertTSTypeToSchema } from "../schema";
import { CallContext } from "../context";
import { dumpNode, dumpSymbol } from "@symbolism/ts-debug";
import { areSchemasEqual, nonConcreteInputs } from "../classify";
import { resolveSymbolsInSchema } from "../value-eval/symbol";
import { defineSymbol } from "@symbolism/definitions";
import { NodeError, removeDuplicates } from "@symbolism/utils";
import { expandUnions } from "../value-eval/union";
import { isNamedDeclaration } from "@symbolism/ts-utils";

export type FunctionCallInfo = {
  callExpression: ts.CallExpression;
  arguments: AnySchemaNode[];
  symbols: ts.Symbol[];
};

export function loadFunctionCalls(
  symbol: ts.Symbol,
  context: CallContext
): FunctionCallInfo[] {
  const functionCalls = convertFunctionCallsForSymbol(symbol, context);

  // TODO: Flatten binary expressions, etc
  return functionCalls;
}
function convertFunctionCallsForSymbol(
  symbol: ts.Symbol,
  context: CallContext
): FunctionCallInfo[] {
  const { symbols } = context;

  const referenceSet = symbols.get(symbol);
  const references = referenceSet && Array.from(referenceSet);

  const calls = (references ?? [])
    .map((reference) => {
      const call = findAncestor(reference, ts.isCallExpression)!;
      if (call) {
        if (call.expression === reference) {
          return call;
        } else if (
          ts.isPropertyAccessExpression(call.expression) &&
          call.expression.name === reference
        ) {
          return call;
        }
      }

      return undefined!;
    })
    .filter(Boolean);

  const collectedCalls: FunctionCallInfo[] = [];

  calls.forEach((callExpression) => {
    try {
      convertCall(callExpression, context, collectedCalls);
    } catch (e: any) {
      throw new NodeError(
        "Error converting call " +
          JSON.stringify(dumpSymbol(symbol, context.checker)),
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
) {
  const { checker } = context;

  const signature = checker.getResolvedSignature(callExpression)!;
  const parameterSymbols = signature.getParameters();

  const argSchemas = callExpression.arguments.map((argument, i) => {
    const schema = convertTSTypeToSchema(...context.clone(undefined, argument));

    const inputs = nonConcreteInputs(schema);
    const inputSymbols = inputs.map((input) =>
      defineSymbol(input, context.checker, {
        chooseLocal: true,
      })
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

  // We have parameters that need to be resolved via upstream calls.
  const upstreamCalls = new Map<ts.SignatureDeclaration, FunctionCallInfo[]>();
  functionDeclarations.forEach((declaration) => {
    let symbol: ts.Symbol | undefined =
      checker.getSymbolAtLocation(declaration);
    if (declaration.name) {
      symbol = context.checker.getSymbolAtLocation(declaration.name);
    } else if (
      isNamedDeclaration(declaration.parent) &&
      declaration.parent.name
    ) {
      symbol = context.checker.getSymbolAtLocation(declaration.parent.name);
    } else {
      symbol = context.checker.getSymbolAtLocation(declaration.parent);
    }
    if (!symbol) {
      // This was likely renamed or passed into a function as an argument.
      // For now we can't go any further than this. In the future we may
      // be able to go further if we trace the callbacks.
      // throw new NodeError(
      //   "Could not find symbol",
      //   declaration,
      //   context.checker
      // );
      return;
    }

    const upstreamCall = convertFunctionCallsForSymbol(symbol, context);
    upstreamCalls.set(declaration, upstreamCall);
  });

  let partiallyResolvedArgSchemas: AnySchemaNode[][] = [];

  // Outer call should always be bound
  const firstDeclaration = functionDeclarations.shift()!;
  if (firstDeclaration) {
    const upstreamCall = upstreamCalls.get(firstDeclaration);
    if (!upstreamCall?.length) {
      // If we have no calls at this level, then there is nothing to resolve for any thing inside.
      partiallyResolvedArgSchemas.push(argSchemas.map((arg) => arg.schema));
    } else {
      upstreamCall.forEach((call) => {
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
  } else {
    // No calls, so everything is resolved.
    partiallyResolvedArgSchemas.push(argSchemas.map((arg) => arg.schema));
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
    const expandedArgs = expandUnions({
      items: argSchemas,
      merger() {
        return undefined;
      },
    });

    expandedArgs.forEach((args) => {
      collectedCalls.push({
        callExpression,
        arguments: args,
        symbols: parameterSymbols,
      });
    });
  });
}
