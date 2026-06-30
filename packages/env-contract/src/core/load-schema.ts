import { createJiti } from "jiti";
import path from "node:path";
import { t3EnvLoader } from "../loaders/t3-env.js";
import { zodLoader } from "../loaders/zod.js";
import { valibotLoader } from "../loaders/valibot.js";
import { arktypeLoader } from "../loaders/arktype.js";
import { standardSchemaLoader } from "../loaders/standard-schema.js";
import type { Schema } from "../loaders/types.js";
import { toError, errorCode } from "../utils/errors.js";

// Vendor-specific loaders first (rich introspection); the generic Standard Schema
// adapter is the catch-all and MUST stay last, since Zod/Valibot/ArkType are all
// Standard-Schema-compliant and we prefer their fuller key/type/default info.
const registeredLoaders = [
  t3EnvLoader,
  zodLoader,
  valibotLoader,
  arktypeLoader,
  standardSchemaLoader,
];

export async function loadSchema(
  pathOrOptions: string | { path: string; cwd?: string },
  cwdFallback?: string,
): Promise<Schema> {
  let schemaPath: string;
  let cwd = cwdFallback || process.cwd();

  if (typeof pathOrOptions === "object" && pathOrOptions !== null) {
    schemaPath = pathOrOptions.path;
    if (pathOrOptions.cwd) {
      cwd = pathOrOptions.cwd;
    }
  } else {
    schemaPath = pathOrOptions;
  }

  const absolutePath = path.isAbsolute(schemaPath) ? schemaPath : path.resolve(cwd, schemaPath);

  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    fsCache: false, // Disable cache for CLI use to ensure we get fresh schema
  });

  try {
    const mod = await jiti.import<Record<string, unknown>>(absolutePath);

    // Sort keys to prioritize explicit naming conventions
    const keys = Object.keys(mod);
    const prioritized = ["envSchema", "env", "default"];
    const otherKeys = keys.filter((k) => !prioritized.includes(k));
    const sortedKeys = [...prioritized.filter((k) => keys.includes(k)), ...otherKeys];

    // 1. Try to find an explicit loader match in prioritized exports
    for (const key of sortedKeys) {
      const exported = mod[key];
      for (const loader of registeredLoaders) {
        if (loader.matches(exported)) {
          return loader.introspect(exported);
        }
      }
    }

    // 2. Fallback: search for common naming conventions if no structural match found in exports list
    if (mod.env) {
      for (const loader of registeredLoaders) {
        if (loader.matches(mod.env)) {
          return loader.introspect(mod.env);
        }
      }
    }

    throw new Error(`Could not find a valid schema exported from ${schemaPath}`);
  } catch (error: unknown) {
    if (errorCode(error) === "MODULE_NOT_FOUND") {
      throw new Error(`Schema file not found at ${absolutePath}`);
    }
    const message = toError(error).message;
    if (message && !message.includes("Could not find a valid")) {
      throw new Error(
        `Failed to load schema from ${schemaPath}.\n👉 Suggestion: Check the file for syntax or TypeScript errors.\n\nUnderlying error:\n${message}`,
      );
    }
    throw error;
  }
}
