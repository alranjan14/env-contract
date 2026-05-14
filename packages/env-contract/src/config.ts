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

import { createJiti } from "jiti";
import path from "node:path";

export async function loadConfig(configPath: string): Promise<Config> {
  try {
    const jiti = createJiti(import.meta.url);
    const absolutePath = path.isAbsolute(configPath) ? configPath : path.resolve(process.cwd(), configPath);
    const mod = await jiti.import(absolutePath, { default: true }) as any;
    return mod?.default || mod || {};
  } catch (e) {
    return {};
  }
}
