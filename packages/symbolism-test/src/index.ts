import { assertExists } from "@symbolism/utils";
import path from "path";
import ts from "typescript";

// Used for dumpSchema unit test
declare module "./dump-symbol" {
  export interface Schema {
    merged: number;
  }
}

export function mockProgram(
  sourceFiles: Record<string, string>,
  options?: ts.CompilerOptions
): ts.Program {
  const host: ts.CompilerHost = {
    fileExists(fileName) {
      return sourceFiles[fileName] !== undefined || ts.sys.fileExists(fileName);
    },
    readFile(fileName) {
      return sourceFiles[fileName] || ts.sys.readFile(fileName);
    },
    writeFile() {
      throw new Error("NOT IMPLEMENTED");
    },
    getSourceFile(fileName) {
      if (!host.fileExists(fileName)) {
        return undefined;
      }

      return ts.createSourceFile(
        fileName,
        assertExists(host.readFile(fileName)),
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
      options
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
      ...options,
    },
    host,
  });
}
