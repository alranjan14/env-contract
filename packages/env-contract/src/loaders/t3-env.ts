import type { Schema, SchemaEntry, SchemaLoader } from "./types.js";
import { introspectZodSchema, introspectZodShape } from "./zod.js";

interface T3EnvLike {
  _def?: unknown;
  _server?: unknown;
  _client?: unknown;
  server?: unknown;
  client?: unknown;
}

/** Looks like a schema (Zod v3/v4, Valibot, …) rather than a plain value. */
function isSchemaLike(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    ("_def" in value || "def" in value || "~standard" in value)
  );
}

/**
 * A `server`/`client` *record* mapping env keys to schemas — the arguments you
 * pass to `createEnv`. The `createEnv` return value only exposes validated
 * *values* (no schemas, no marker), so env-contract introspects the record the
 * user exports alongside it.
 */
function isSchemaRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const values = Object.values(value);
  return values.length > 0 && values.every(isSchemaLike);
}

export function isT3Env(obj: unknown): boolean {
  if (obj === null || typeof obj !== "object") return false;
  const env = obj as T3EnvLike;

  // Real shape: the `{ server, client }` schema records passed to `createEnv`.
  if (isSchemaRecord(env.server) || isSchemaRecord(env.client)) return true;

  // Legacy/mocked shape: a wrapper exposing `_server`/`_client` as Zod objects.
  return "_def" in env && ("_server" in env || "_client" in env);
}

export function introspectT3Env(obj: unknown): Schema {
  const env = obj as T3EnvLike;
  const entries: SchemaEntry[] = [];

  // Real `{ server, client }` records of schemas.
  if (isSchemaRecord(env.server)) entries.push(...introspectZodShape(env.server, "server"));
  if (isSchemaRecord(env.client)) entries.push(...introspectZodShape(env.client, "client"));

  // Legacy `_server`/`_client` Zod objects.
  if (entries.length === 0) {
    if (env._server) entries.push(...introspectZodSchema(env._server, "server").entries);
    if (env._client) entries.push(...introspectZodSchema(env._client, "client").entries);
  }

  // Deduplicate by key (server wins over client).
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
