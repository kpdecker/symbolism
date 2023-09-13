import type { defineSymbol } from "@noom-symbolism/definitions";
import type { AnySchemaNode } from "@noom-symbolism/type-eval";

import { getNodePath } from "@noom-symbolism/paths";
import {
  isIntrinsicType,
  isTypeReference,
  getSymbolId,
} from "@noom-symbolism/ts-utils";
import invariant from "tiny-invariant";
import ts, { ObjectType } from "typescript";
import { relative } from "path";
import { bitwiseFlagSet } from "@noom-symbolism/utils";

export function dumpFlags(
  flags: number | undefined,
  allFlags: Record<number, string>
) {
  const ret: string[] = [];
  Object.keys(allFlags).forEach((key) => {
    const number = parseInt(key, 10);
    if (
      // Flag is set
      number &&
      bitwiseFlagSet(flags, number) &&
      // And it's not a combined flag
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      !(~flags! & number)
    ) {
      // Iterate to pick the first vs. last for duplicates
      ret.push(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        Object.keys(allFlags).find(
          (key) =>
            (allFlags[key as unknown as number] as unknown as number) === number
        )!
      );
    }
  });
  return ret;
}

export function dumpDefinition(
  inferred: ReturnType<typeof defineSymbol>,
  checker: ts.TypeChecker
) {
  if (!inferred) {
    return inferred;
  }
  const symbol = dumpSymbol(inferred.symbol, checker);
  const type = inferred.getType();
  return {
    type: type && checker.typeToString(type),
    symbol: symbol?.declaration,
  };
}

export function dumpSymbol(
  symbol: ts.Symbol | undefined | null,
  checker: ts.TypeChecker
) {
  if (!symbol) {
    return undefined;
  }

  const declarations = symbol?.declarations || [];
  const declarationDump: NonNullable<ReturnType<typeof dumpNode>>[] =
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    declarations.map((node) => dumpNode(node, checker)!).filter(Boolean);

  if (symbol && !declarations.length) {
    const name = symbol.getName();
    if (
      symbol.flags & ts.SymbolFlags.Transient &&
      !["undefined", "arguments"].includes(name)
    ) {
      declarationDump.push({
        kind: "transient",
        name: name,
        location: "transient",
        path: name,
      });
    } else if (isIntrinsicType(checker.getDeclaredTypeOfSymbol(symbol))) {
      declarationDump.push({
        kind: "keyword",
        name: name,
        location: "intrinsic",
        path: name,
      });
    }
  }

  invariant(
    !symbol || declarationDump.length,
    "Missing declaration: " + symbol?.getName()
  );

  return {
    id: getSymbolId(symbol),
    flags: dumpFlags(symbol?.getFlags(), ts.SymbolFlags),
    declaration: declarationDump,
  };
}

export function dumpNode(
  node: ts.Node | undefined,
  checker: ts.TypeChecker,
  omitPath = false
) {
  if (!node) {
    return undefined;
  }

  const sourceFile = node.getSourceFile();
  const fileName = sourceFile.fileName;
  const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart());

  const ret = {
    kind: ts.SyntaxKind[node.kind],
    name: "",
    path: !omitPath ? getNodePath(node, checker) : "",
    location:
      relative(".", fileName) +
      ":" +
      (lineAndChar.line + 1) +
      ":" +
      (lineAndChar.character + 1),
  };

  let name = node.getText().split(/\n/g)[0];
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    if (ts.isVariableDeclaration(node.parent)) {
      // TODO: Perform this mapping in the symbol table
      name = node.parent.name.getText();
    }
  } else if (ts.isFunctionDeclaration(node)) {
    name = node.name?.getText() || name;
  } else if (ts.isPropertyAssignment(node)) {
    const declaration = ts.findAncestor(node, (node) =>
      ts.isVariableDeclaration(node)
    ) as ts.VariableDeclaration;
    if (declaration) {
      const symbol = checker.getSymbolAtLocation(node.parent.parent.parent);
      name =
        declaration.name.getText() +
        " " +
        (symbol && checker.getFullyQualifiedName(symbol));
    }
  }
  ret.name = name;

  return ret;
}

export function dumpType(
  type: ts.Type | undefined,
  checker: ts.TypeChecker,
  recurse = true
) {
  if (!type) {
    return undefined;
  }
  const { declaration: symbolDeclaration, ...symbol } =
    dumpSymbol(type.getSymbol(), checker) || {};

  const isReference = isTypeReference(type);

  function recurseDump(type: ts.Type | undefined) {
    if (recurse) {
      // any to break circular return type inference
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (dumpType as any)(type, checker, false);
    }
  }

  const response = {
    type: checker.typeToString(type),
    flags: dumpFlags(type.getFlags(), ts.TypeFlags),
    objectFlags: dumpFlags((type as ObjectType).objectFlags, ts.ObjectFlags),
    symbol,
    symbolDeclaration,
    constraint: recurseDump(type.getConstraint()),
    aliasSymbol: dumpSymbol(type.aliasSymbol, checker),
    aliasTypeArguments: recurse
      ? type.aliasTypeArguments?.map(recurseDump)
      : undefined,

    referenceTarget: isReference && recurseDump(type.target),
    referenceTypeArguments:
      isReference && recurse ? type.typeArguments?.map(recurseDump) : undefined,
  };

  return JSON.parse(JSON.stringify(response)) as Partial<typeof response>;
}

export function dumpSchema(
  schema: AnySchemaNode | AnySchemaNode[] | undefined
) {
  return JSON.stringify(
    schema,
    (key, value) => {
      if (key === "node") {
        return (
          ts.SyntaxKind[(value as ts.Node)?.kind] +
          ": " +
          (value as ts.Node)?.getText()
        );
      } else if (key === "symbol") {
        return (value as ts.Symbol)?.getName();
      } else if (key === "unboundSymbol") {
        return (value as ts.Symbol)?.getName();
      }
      return value;
    },
    2
  );
}
