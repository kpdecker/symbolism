import invariant from 'tiny-invariant';
import ts from 'typescript';
import { dumpSymbol } from '../src/symbols';
import { defineSymbol } from '../src/definition-symbol/index';
import { isIntrinsicType } from '../src/utils';

export function mockProgram(sourceFiles: Record<string, string>) {
  const host: ts.CompilerHost = {
    fileExists(fileName) {
      return sourceFiles[fileName] !== undefined || ts.sys.fileExists(fileName);
    },
    readFile(fileName) {
      return sourceFiles[fileName] || ts.sys.readFile(fileName);
    },
    writeFile(fileName, text) {
      throw new Error('NOT IMPLEMENTED');
    },
    getSourceFile(fileName) {
      invariant(
        host.fileExists(fileName),
        'getSourceFile: file not found: ' + fileName
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
      return '';
    },
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    useCaseSensitiveFileNames() {
      return true;
    },
    getNewLine() {
      return '\n';
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
  return {
    type: checker.typeToString(inferred?.type!),
    symbol: dumpSymbol(inferred!.symbol, checker),
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
