import { createJiti } from "jiti";
import path from "node:path";
import { t3EnvLoader } from "../loaders/t3-env.js";
import { zodLoader } from "../loaders/zod.js";
import { valibotLoader } from "../loaders/valibot.js";
import { arktypeLoader } from "../loaders/arktype.js";
import type { Schema } from "../loaders/types.js";

const registeredLoaders = [t3EnvLoader, zodLoader, valibotLoader, arktypeLoader];

export async function loadSchema(schemaPath: string, cwd: string = process.cwd()): Promise<Schema> {
  const absolutePath = path.isAbsolute(schemaPath) 
    ? schemaPath 
    : path.resolve(cwd, schemaPath);

  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    fsCache: false, // Disable cache for CLI use to ensure we get fresh schema
  });

  try {
    const mod = await jiti.import(absolutePath) as any;
    
    // 1. Try to find an explicit loader match in any export
    for (const key of Object.keys(mod)) {
      const exported = mod[key];
      for (const loader of registeredLoaders) {
        if (loader.matches(exported)) {
          return loader.introspect(exported);
        }
      }
    }

    // 2. Fallback: search for common naming conventions if no structural match found
    if (mod.env) {
      for (const loader of registeredLoaders) {
        if (loader.matches(mod.env)) {
          return loader.introspect(mod.env);
        }
      }
    }

    throw new Error(`Could not find a valid schema exported from ${schemaPath}`);
  } catch (error: any) {
    if (error.code === "MODULE_NOT_FOUND") {
      throw new Error(`Schema file not found at ${absolutePath}`);
    }
    if (error.message && !error.message.includes("Could not find a valid")) {
      throw new Error(`Failed to load schema from ${schemaPath}.\n👉 Suggestion: Check the file for syntax or TypeScript errors.\n\nUnderlying error:\n${error.message}`);
    }
    throw error;
  }
}
