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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * Validate the shape of a loaded config and narrow `unknown` to `Config`. Hand
 * rolled (no zod — it's an optional peer dependency) so a malformed config fails
 * with a clear, actionable message instead of breaking deep in the engine.
 */
export function assertConfig(value: unknown, source: string): asserts value is Config {
  if (typeof value !== "object" || value === null) {
    throw new Error(`env-contract config (${source}) must export an object.`);
  }
  const c = value as Record<string, unknown>;

  for (const key of ["schema", "exampleFile", "rootDir"] as const) {
    if (c[key] !== undefined && typeof c[key] !== "string") {
      throw new Error(`env-contract config (${source}): "${key}" must be a string.`);
    }
  }

  if (c.ignoreKeys !== undefined && !isStringArray(c.ignoreKeys)) {
    throw new Error(`env-contract config (${source}): "ignoreKeys" must be an array of strings.`);
  }

  if (c.scan !== undefined) {
    if (typeof c.scan !== "object" || c.scan === null) {
      throw new Error(`env-contract config (${source}): "scan" must be an object.`);
    }
    const scan = c.scan as Record<string, unknown>;
    if (scan.include !== undefined && !isStringArray(scan.include)) {
      throw new Error(
        `env-contract config (${source}): "scan.include" must be an array of strings.`,
      );
    }
    if (scan.exclude !== undefined && !isStringArray(scan.exclude)) {
      throw new Error(
        `env-contract config (${source}): "scan.exclude" must be an array of strings.`,
      );
    }
  }
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

  const resolved = mod !== null && typeof mod === "object" && "default" in mod ? mod.default : mod;

  if (resolved === null || resolved === undefined) return {};
  assertConfig(resolved, absolutePath);
  return resolved;
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
    const fromPkg = pkg["env-contract"];
    if (fromPkg) {
      assertConfig(fromPkg, `${pkgPath} ("env-contract" field)`);
      return fromPkg;
    }
  } catch (error) {
    // A missing package.json is fine; a malformed one should surface.
    if (errorCode(error) !== "ENOENT") {
      throw new Error(`Failed to read package.json config in ${cwd}: ${toError(error).message}`);
    }
  }

  return {};
}
