import type { Schema, SchemaEntry, SchemaLoader } from "./types.js";

// Generic fallback loader for any Standard Schema v1 validator
// (https://standardschema.dev) that does NOT have a richer dedicated loader.
// Registered LAST, so Zod / Valibot / ArkType / t3-env still win for their
// vendors — this only catches validators we don't otherwise recognize.
//
// IMPORTANT: Standard Schema exposes *validation*, not *introspection* — there is
// no generic way to read a schema's shape. We recover the **required** keys by
// validating an empty object and reading the top-level key from each issue's
// `path`. Optional keys never error on absence, so they cannot be discovered this
// way; that limitation is documented rather than papered over. Fully typed
// (no `any`), so unlike the vendor loaders it needs no lint quarantine.

interface StandardIssue {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
}

type StandardResult =
  | { readonly value: unknown }
  | { readonly issues: ReadonlyArray<StandardIssue> };

interface StandardSchemaV1 {
  readonly "~standard": {
    readonly version: number;
    readonly vendor: string;
    readonly validate: (value: unknown) => StandardResult | Promise<StandardResult>;
  };
}

export function isStandardSchema(mod: unknown): mod is StandardSchemaV1 {
  if (mod === null || typeof mod !== "object") return false;
  const std = (mod as { "~standard"?: unknown })["~standard"];
  if (std === null || typeof std !== "object") return false;
  const s = std as { version?: unknown; validate?: unknown };
  return s.version === 1 && typeof s.validate === "function";
}

function isThenable(
  value: StandardResult | Promise<StandardResult>,
): value is Promise<StandardResult> {
  return value instanceof Promise || typeof (value as { then?: unknown }).then === "function";
}

/** First path segment as a string key, normalizing the `{ key }` segment form. */
function pathHead(issue: StandardIssue): string | undefined {
  const seg = issue.path?.[0];
  if (seg === undefined || seg === null) return undefined;
  const key = typeof seg === "object" ? seg.key : seg;
  return typeof key === "string" ? key : undefined;
}

export function introspectStandardSchema(mod: unknown): Schema {
  const schema = mod as StandardSchemaV1;
  const result = schema["~standard"].validate({});

  if (isThenable(result)) {
    throw new Error(
      "This validator uses asynchronous validation, which the generic Standard Schema " +
        "adapter cannot introspect. Use synchronous validation, or a validator with a " +
        "dedicated loader (Zod, Valibot, ArkType).",
    );
  }

  // No issues means the empty object validated — every key is optional, and
  // optional keys are not discoverable through validation alone.
  if (!("issues" in result)) {
    return { entries: [] };
  }

  const keys = new Set<string>();
  for (const issue of result.issues) {
    const key = pathHead(issue);
    if (key) keys.add(key);
  }

  const entries: SchemaEntry[] = [...keys].map((key) => ({
    key,
    type: "unknown",
    optional: false,
    scope: "server",
  }));

  return { entries };
}

export const standardSchemaLoader: SchemaLoader = {
  matches: isStandardSchema,
  introspect: introspectStandardSchema,
};
