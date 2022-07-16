import ts from "typescript";
import { dumpSymbol } from "../src/symbols";
import { defineSymbol } from "../src/definition-symbol/index";
import { getSymbolDeclaration } from "../src/utils";
import path from "path";

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
      if (!host.fileExists(fileName)) {
        return undefined;
      }

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
    resolveModuleNames(
      moduleNames,
      containingFile,
      reusedNames,
      redirectedReference,
      options,
      containingSourceFile?
    ) {
      return moduleNames.map(
        (moduleName): ts.ResolvedModuleFull | undefined => {
          const mockPaths = [
            moduleName + ".ts",
            moduleName + ".tsx",
            moduleName,
          ];
          for (const mockPath of mockPaths) {
            const mockedModule = sourceFiles[mockPath];
            if (mockedModule) {
              return {
                resolvedFileName: mockPath,
                extension: path.extname(mockPath) as ts.Extension,
              };
            }
          }

          const resolved = ts.resolveModuleName(
            moduleName,
            containingFile,
            options,
            host
          );
          if (resolved.resolvedModule) {
            return resolved.resolvedModule;
          }
          return undefined;
        }
      );
    },
    useCaseSensitiveFileNames() {
      return true;
    },
    getNewLine() {
      return "\n";
    },
  };

  return ts.createProgram({
    rootNames: Object.keys(sourceFiles),
    options: {
      target: ts.ScriptTarget.ES2017,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
    },
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
  const declarations = symbol.declaration.map((x) => {
    return {
      ...x,
      fileName: x.fileName.includes("node_modules")
        ? x.fileName.replace(/.*\/node_modules\//, "")
        : x.fileName,
    };
  });
  return {
    type: checker.typeToString(inferred?.type!),
    symbol: declarations,
  };
}

export function dumpFlags(
  flags: number | undefined,
  allFlags: Record<number, string>
) {
  const ret: string[] = [];
  Object.keys(allFlags).forEach((key) => {
    const number = parseInt(key, 10);
    if (!isNaN(number)) {
      if (flags! & number) {
        if (
          !allFlags[number]?.endsWith("Excludes") &&
          allFlags[number] !== "All"
        ) {
          ret.push(allFlags[number]);
        }
      }
    }
  });
  return ret;
}

export function getPropertyValueType(
  objectType: ts.Type,
  propertyName: string,
  checker: ts.TypeChecker
) {
  const property = objectType.getProperty(propertyName);
  if (!property) {
    return undefined;
  }
  return checker.getTypeAtLocation(getSymbolDeclaration(property)!);
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
