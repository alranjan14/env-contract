export interface Config {
  schema?: string;
  exampleFile?: string;
  rootDir?: string;
  scan?: {
    include?: string[];
    exclude?: string[];
  };
  ignoreKeys?: string[];
}

export function defineConfig(config: Config): Config {
  return config;
}
