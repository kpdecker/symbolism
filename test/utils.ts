import invariant from "tiny-invariant";
import ts from "typescript";
import { dumpSymbol } from "../src/symbols";
import { defineSymbol } from "../src/definition-symbol/index";
import { isIntrinsicType } from "../src/utils";

export function testStatement(source: string) {
  const program = mockProgram({
    "test.ts": source + ";",
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile("test.ts")!;
  const node = sourceFile.statements[0];

  return dumpInferred(defineSymbol(node, checker)!, checker);
}

export function testExpression(source: string) {
  const program = mockProgram({
    "test.ts": "var bar = " + source + ";",
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile("test.ts")!;
  const node = findNodeInTree(sourceFile, ts.isVariableDeclaration);

  return dumpInferred(defineSymbol(node?.initializer!, checker)!, checker);
}

export function mockProgram(sourceFiles: Record<string, string>) {
  const host: ts.CompilerHost = {
    fileExists(fileName) {
      return sourceFiles[fileName] !== undefined || ts.sys.fileExists(fileName);
    },
    readFile(fileName) {
      return sourceFiles[fileName] || ts.sys.readFile(fileName);
    },
    writeFile(fileName, text) {
      throw new Error("NOT IMPLEMENTED");
    },
    getSourceFile(fileName) {
      invariant(
        host.fileExists(fileName),
        "getSourceFile: file not found: " + fileName
      );
      return ts.createSourceFile(
        fileName,
        host.readFile(fileName)!,
        ts.ScriptTarget.ES2022
      );
    },
    getCanonicalFileName(fileName) {
      return fileName;
    },
    getCurrentDirectory() {
      return process.cwd();
    },
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    useCaseSensitiveFileNames() {
      return true;
    },
    getNewLine() {
      return "\n";
    },
  };

  return ts.createProgram({
    rootNames: Object.keys(sourceFiles),
    options: {},
    host,
  });
}

export function dumpInferred(
  inferred: ReturnType<typeof defineSymbol>,
  checker: ts.TypeChecker
) {
  if (!inferred) {
    return inferred;
  }
  const symbol = dumpSymbol(inferred!.symbol, checker);
  symbol.forEach((x) => {
    x.fileName = x.fileName.includes("node_modules")
      ? x.fileName.replace(/.*\/node_modules\//, "")
      : x.fileName;
  });
  return {
    type: checker.typeToString(inferred?.type!),
    symbol,
  };
}

export function getPropertyValueType(
  objectType: ts.Type,
  propertyName: string,
  checker: ts.TypeChecker
) {
  const property = objectType.getProperty(propertyName);
  return checker.getTypeAtLocation(property?.valueDeclaration!);
}

export function findNodeInTree<T extends ts.Node>(
  node: ts.Node,
  matcher: (node: ts.Node) => node is T
): T | undefined {
  if (matcher(node)) {
    return node;
  }

  for (const child of node.getChildren()) {
    const result = findNodeInTree(child, matcher);
    if (result) {
      return result;
    }
  }

  return undefined;
}

export function findNodesInTree<T extends ts.Node>(
  node: ts.Node,
  matcher: (node: ts.Node) => node is T
): T[] {
  if (matcher(node)) {
    return [node];
  }

  const ret = [];
  for (const child of node.getChildren()) {
    ret.push(...findNodesInTree(child, matcher));
  }

  return ret;
}
