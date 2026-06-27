import { createJiti } from "jiti";
import path from "node:path";
import fs from "node:fs/promises";
import { toError, errorCode } from "./utils/errors.js";

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

/**
 * Load a config file that is known/expected to exist. A failure here (syntax
 * error, bad import, throwing `defineConfig`) is a real problem the user needs
 * to see — it is NOT silently swallowed into an empty config.
 */
export async function loadConfig(configPath: string): Promise<Config> {
  const absolutePath = path.isAbsolute(configPath)
    ? configPath
    : path.resolve(process.cwd(), configPath);

  let mod: unknown;
  try {
    const jiti = createJiti(import.meta.url);
    mod = await jiti.import(absolutePath, { default: true });
  } catch (error) {
    throw new Error(`Failed to load config at ${absolutePath}: ${toError(error).message}`);
  }

  const resolved =
    mod !== null && typeof mod === "object" && "default" in mod
      ? (mod as { default: unknown }).default
      : mod;

  return (resolved ?? {}) as Config;
}

export async function resolveConfig(cwd: string, explicitConfigPath?: string): Promise<Config> {
  // An explicitly requested config that fails to load is a hard error.
  if (explicitConfigPath) {
    return loadConfig(path.resolve(cwd, explicitConfigPath));
  }

  const exts = [".ts", ".js", ".mjs", ".cjs"];
  for (const ext of exts) {
    const configPath = path.join(cwd, `env-contract.config${ext}`);
    let exists = false;
    try {
      await fs.access(configPath);
      exists = true;
    } catch {
      // File absent for this extension — keep probing the others.
    }
    // Load OUTSIDE the existence try/catch so load errors propagate instead of
    // being misread as "config not found".
    if (exists) {
      return loadConfig(configPath);
    }
  }

  try {
    const pkgPath = path.join(cwd, "package.json");
    const pkgContent = await fs.readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(pkgContent) as Record<string, unknown>;
    if (pkg["env-contract"]) {
      return pkg["env-contract"] as Config;
    }
  } catch (error) {
    // A missing package.json is fine; a malformed one should surface.
    if (errorCode(error) !== "ENOENT") {
      throw new Error(`Failed to read package.json config in ${cwd}: ${toError(error).message}`);
    }
  }

  return {};
}
