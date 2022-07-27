import path from "path";
import ts from "typescript";

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
