import { readFileSync } from 'fs';
import { glob } from 'glob';
import minimatch from 'minimatch';
import { SetRequired } from 'type-fest';

export type ConfigFileSchema = {
  /**
   * @default current working directory
   */
  baseDir: string;

  /**
   * @default 'tsconfig.json'
   */
  tsConfigPath: string;

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

export type Config = Omit<ConfigFileSchema, 'min' | 'tokens' | 'exclude'> & {
  // Object form is the only internal representation
  tokens: SetRequired<Exclude<ConfigFileSchema['tokens'][0], string>, 'min'>[];
  exclude: (fileName: string) => boolean;
};

export function parseConfig(configFilePath: string): Config {
  const config: Partial<ConfigFileSchema> = JSON.parse(
    readFileSync(configFilePath, 'utf8')
  );

  const min = config.min ?? 1;

  function exclude(fileName: string) {
    return (
      config.exclude?.some((pattern) => minimatch(fileName, pattern)) ?? false
    );
  }

  return {
    baseDir: process.cwd(),
    tsConfigPath: 'tsconfig.json',
    ...config,

    entryPoints: (config.entryPoints || ['src/index.ts']).flatMap((pattern) =>
      glob.sync(pattern).filter((fileName) => !exclude(fileName))
    ),
    tokens: (config.tokens || []).map((token) =>
      typeof token === 'string' ? { name: token, min } : { ...token, min }
    ),
    exclude,
  };
}
