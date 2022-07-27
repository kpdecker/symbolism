import { getNodePath } from "@symbolism/paths";
import { isIntrinsicType, lineAndColumn } from "@symbolism/ts-utils";
import invariant from "tiny-invariant";
import ts from "typescript";

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
      (flags! & number) === number &&
      // And it's not a combined flag
      !(~flags! & number)
    ) {
      // Iterate to pick the first vs. last for duplicates
      ret.push(
        Object.keys(allFlags).find(
          (key) => (allFlags[key as any] as unknown as number) === number
        )!
      );
    }
  });
  return ret;
}

export function dumpSymbol(
  symbol: ts.Symbol | undefined,
  checker: ts.TypeChecker
) {
  const declarations = symbol?.declarations || [];
  const declarationDump: ReturnType<typeof dumpNode>[] = declarations.map(
    (node) => dumpNode(node, checker)
  );

  if (symbol && !declarations.length) {
    const name = symbol.getName();
    if (
      symbol.flags & ts.SymbolFlags.Transient &&
      !["undefined", "arguments"].includes(name)
    ) {
      declarationDump.push({
        kind: "transient",
        name: name,
        fileName: "transient",
        path: name,
        line: 1,
        column: 1,
      });
    } else if (isIntrinsicType(checker.getDeclaredTypeOfSymbol(symbol))) {
      declarationDump.push({
        kind: "keyword",
        name: name,
        fileName: "intrinsic",
        path: name,
        line: 1,
        column: 1,
      });
    }
  }

  invariant(
    !symbol || declarationDump.length,
    "Missing declaration: " + symbol?.getName()
  );

  return {
    id: (symbol as any)?.id,
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
    return {
      kind: "Undefined",
      name: "undefined",
      fileName: "undefined",
      path: "undefined",
      line: 1,
      column: 1,
    };
  }

  const sourceFile = node.getSourceFile();
  const fileName = sourceFile.fileName;
  const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart());

  const ret = {
    kind: ts.SyntaxKind[node.kind],
    name: "",
    path: !omitPath ? getNodePath(node, checker) : "",
    fileName,
    ...lineAndColumn(lineAndChar),
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
      name =
        declaration.name.getText() +
        " " +
        (checker.getSymbolAtLocation(node.parent.parent.parent) &&
          checker.getFullyQualifiedName(
            checker.getSymbolAtLocation(node.parent.parent.parent)!
          ));
    }
  }
  ret.name = name;

  return ret;
}
