import type { Schema, SchemaEntry, SchemaLoader } from "./types.js";
import { introspectZodSchema } from "./zod.js";

interface T3EnvLike {
  _def?: unknown;
  _server?: unknown;
  _client?: unknown;
}

export function isT3Env(obj: unknown): boolean {
  return (
    obj !== null &&
    typeof obj === "object" &&
    "_def" in obj &&
    ("_server" in obj || "_client" in obj)
  );
}

export function introspectT3Env(obj: unknown): Schema {
  const env = obj as T3EnvLike;
  const entries: SchemaEntry[] = [];

  // `as Parameters<...>` defers to whatever the zod introspector accepts without
  // re-exporting its internal schema type.
  type ZodInput = Parameters<typeof introspectZodSchema>[0];

  if (env._server) {
    const serverSchema = introspectZodSchema(env._server as ZodInput, "server");
    entries.push(...serverSchema.entries);
  }

  if (env._client) {
    const clientSchema = introspectZodSchema(env._client as ZodInput, "client");
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

export const t3EnvLoader: SchemaLoader = {
  matches: isT3Env,
  introspect: introspectT3Env,
};
