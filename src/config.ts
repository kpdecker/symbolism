import { readFileSync } from "fs";
import { glob } from "glob";
import minimatch from "minimatch";
import { dirname, relative, resolve } from "path";
import { SetRequired } from "type-fest";

export type ConfigFileSchema = {
  /**
   * Paths are relative to this config file.
   *
   * @default current working directory.
   */
  baseDir: string;

  /**
   * @default 'tsconfig.json'
   */
  tsConfigPath: string;

  /**
   * Path to the istanbul json report output file.
   *
   * Note that this path is relative to the baseDir.
   *
   * @default './coverage/coverage-final.json'
   */
  coverageJsonPath: string;

  /**
   * List of glob match patterns defining the entry points for the project.
   *
   * @default 'src/index.ts'
   */
  entryPoints: string[];

  /**
   * List of glob match patterns defining the files to be excluded from the coverage report.
   * Files in this list will be excluded from both symbol lookup and coverage reporting.
   */
  exclude?: string[];

  tokens: (string | { name: string; min?: number; sourceFile?: string })[];

  /**
   * [0-1]
   * @default 1
   */
  min?: number;
};

export type Config = Omit<ConfigFileSchema, "min" | "tokens" | "exclude"> & {
  // Object form is the only internal representation
  tokens: SetRequired<Exclude<ConfigFileSchema["tokens"][0], string>, "min">[];
  exclude: (fileName: string) => boolean;
};

export function parseConfig(configFilePath: string): Config {
  const config: Partial<ConfigFileSchema> = JSON.parse(
    readFileSync(configFilePath, "utf8")
  );

  const baseDir = resolve(
    config.baseDir || process.cwd(),
    dirname(configFilePath)
  );

  const min = config.min ?? 1;

  function exclude(fileName: string) {
    const relativePath = relative(baseDir, fileName)
      // Normalize node module paths if loaded outside of the project.
      .replace(/.*\/node_modules\//, "node_modules/");
    return (
      config.exclude?.some((pattern) => minimatch(relativePath, pattern)) ??
      false
    );
  }

  const initialConfig = {
    baseDir: process.cwd(),
    tsConfigPath: "tsconfig.json",
    coverageJsonPath: "./coverage/coverage-final.json",
    entryPoints: ["src/index.ts"],
    ...config,
  } as ConfigFileSchema;

  return {
    ...initialConfig,
    baseDir,
    tsConfigPath: resolve(baseDir, initialConfig.tsConfigPath),
    coverageJsonPath: resolve(baseDir, initialConfig.coverageJsonPath),

    entryPoints: config.entryPoints!.flatMap((pattern) =>
      glob
        .sync(pattern, {
          cwd: baseDir,
        })
        .filter((fileName) => !exclude(fileName))
    ),
    tokens: (config.tokens || []).map((token) =>
      typeof token === "string" ? { name: token, min } : { ...token, min }
    ),
    exclude,
  };
}
