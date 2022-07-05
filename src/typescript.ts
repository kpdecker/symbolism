import { existsSync, readFileSync } from 'fs';
import ts from 'typescript';
import { Config } from './config';

export function initTypescript(config: Config) {
  const configPath = ts.findConfigFile(
    process.cwd(),
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
        throw new Error('Config load failed');
      },
    }
  );
  if (!configFile?.options) {
    throw new Error('Failed to attach compilerOptions');
  }

  const servicesHost: ts.LanguageServiceHost = {
    getScriptFileNames: () => config.entryPoints,
    getScriptVersion: (fileName) => '1',
    getScriptSnapshot: (fileName) => {
      if (!existsSync(fileName)) {
        return undefined;
      }

      try {
        return ts.ScriptSnapshot.fromString(readFileSync(fileName).toString());
      } catch (e: any) {
        throw new Error('Failed to read file ' + fileName + ': ' + e.message);
      }
    },
    getCurrentDirectory: () => process.cwd(),
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
