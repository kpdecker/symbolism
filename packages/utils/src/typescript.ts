import { existsSync, readFileSync } from "fs";
import invariant from "tiny-invariant";
import ts from "typescript";
import { Config } from "./config";

export function initTypescript(config: Config, filePath?: string) {
  const configPath = ts.findConfigFile(
    config.baseDir,
    ts.sys.fileExists,
    config.tsConfigPath
  );
  if (!configPath) {
    throw new Error("Could not find a valid 'tsconfig.json'.");
  }

  const configFile = ts.getParsedCommandLineOfConfigFile(
    configPath,
    undefined,
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic(diagnostic) {
        console.error(diagnostic);
        throw new Error("Config load failed");
      },
    }
  );
  if (!configFile?.options) {
    throw new Error("Failed to attach compilerOptions");
  }

  const servicesHost: ts.LanguageServiceHost = {
    getScriptFileNames: () =>
      filePath ? [filePath, ...config.entryPoints] : config.entryPoints,
    getScriptVersion: () => "1",
    getScriptSnapshot: (fileName) => {
      if (!existsSync(fileName)) {
        return undefined;
      }

      try {
        return ts.ScriptSnapshot.fromString(readFileSync(fileName).toString());
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        throw new Error("Failed to read file " + fileName + ": " + e.message);
      }
    },
    getCurrentDirectory: () => config.baseDir || process.cwd(),
    getCompilationSettings: () => configFile.options,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  };

  const documentRegistry = ts.createDocumentRegistry();

  // Create the language service files
  return ts.createLanguageService(servicesHost, documentRegistry);
}

export function assertUnreachable(
  _x: never,
  message = "Unreachable code executed"
): never {
  throw new Error(message);
}

export function assertExists<T>(value: T | undefined | null): T {
  invariant(value != null, "Expected value to be exist");

  return value;
}
