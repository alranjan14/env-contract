import { createJiti } from "jiti";
import path from "node:path";
import fs from "node:fs/promises";

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

export async function resolveConfig(cwd: string, explicitConfigPath?: string): Promise<Config> {
  if (explicitConfigPath) {
    return loadConfig(path.resolve(cwd, explicitConfigPath));
  }

  const exts = [".ts", ".js", ".mjs", ".cjs"];
  for (const ext of exts) {
    const configPath = path.join(cwd, `env-contract.config${ext}`);
    try {
      await fs.access(configPath);
      return await loadConfig(configPath);
    } catch {}
  }

  try {
    const pkgPath = path.join(cwd, "package.json");
    const pkgContent = await fs.readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(pkgContent);
    if (pkg["env-contract"]) {
      return pkg["env-contract"];
    }
  } catch {}

  return {};
}
