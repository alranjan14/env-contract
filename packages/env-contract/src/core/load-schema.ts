import { createJiti } from "jiti";
import path from "node:path";
import { t3EnvLoader } from "../loaders/t3-env.js";
import { zodLoader } from "../loaders/zod.js";
import type { Schema } from "../loaders/types.js";

export async function loadSchema(schemaPath: string, cwd: string = process.cwd()): Promise<Schema> {
  const absolutePath = path.isAbsolute(schemaPath) 
    ? schemaPath 
    : path.resolve(cwd, schemaPath);

  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    fsCache: false, // Disable cache for CLI use to ensure we get fresh schema
  });

  try {
    const mod = await jiti.import(absolutePath);
    
    // 1. Try to find an explicit loader match in any export
    for (const key of Object.keys(mod)) {
      const exported = mod[key];
      
      if (t3EnvLoader.matches(exported)) {
        return t3EnvLoader.introspect(exported);
      }
      
      if (zodLoader.matches(exported)) {
        return zodLoader.introspect(exported);
      }
    }

    // 2. Fallback: search for common naming conventions if no structural match found
    if (mod.env) {
       // mod.env might be the validated object, which t3-env loader handles
       if (t3EnvLoader.matches(mod.env)) return t3EnvLoader.introspect(mod.env);
    }

    throw new Error(`Could not find a valid Zod or t3-env schema exported from ${schemaPath}`);
  } catch (error: any) {
    if (error.code === "MODULE_NOT_FOUND") {
      throw new Error(`Schema file not found at ${absolutePath}`);
    }
    throw error;
  }
}
