import type { Schema, SchemaEntry } from "./types.js";
import { introspectZodSchema } from "./zod.js";

export function isT3Env(obj: any): boolean {
  return (
    obj !== null &&
    typeof obj === "object" &&
    "_def" in obj &&
    ("_server" in obj || "_client" in obj)
  );
}

export function introspectT3Env(obj: any): Schema {
  const entries: SchemaEntry[] = [];

  if (obj._server) {
    const serverSchema = introspectZodSchema(obj._server, "server");
    entries.push(...serverSchema.entries);
  }

  if (obj._client) {
    const clientSchema = introspectZodSchema(obj._client, "client");
    entries.push(...clientSchema.entries);
  }

  // Deduplicate entries if any (though t3-env usually keeps them separate)
  const seen = new Set<string>();
  const uniqueEntries = entries.filter((entry) => {
    if (seen.has(entry.key)) return false;
    seen.add(entry.key);
    return true;
  });

  return { entries: uniqueEntries };
}

export const t3EnvLoader = {
  matches: isT3Env,
  introspect: introspectT3Env,
};
