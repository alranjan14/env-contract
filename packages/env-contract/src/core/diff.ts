import type { Schema } from "../loaders/types.js";
import type { Reference } from "./scan-source.js";

export interface DiffReport {
  exampleDrift: {
    missingInExample: string[];
    extraInExample: string[];
  };
  orphanedRefs: Reference[];
  unusedSchemaKeys: string[];
}

/**
 * Full contract diff in one call: example-file drift (schema vs a set of
 * `.env.example` keys) plus scan-side drift (orphaned code references and, under
 * `strict`, unused schema keys). Part of the public programmatic API.
 *
 * The CLI itself does not use the example-drift half here — `sync`/`check` call
 * `computeKeyDrift` directly against the managed block and pass `[]` for
 * `exampleKeys` — but the parameter stays so programmatic callers can get a
 * complete diff from a single call. The example-drift rule is delegated to
 * `computeKeyDrift` below so there is exactly one implementation of it.
 */
export function diff(
  schema: Schema,
  exampleKeys: string[],
  scannerRefs: Reference[],
  options: { strict?: boolean; ignoreKeys?: string[] } = {},
): DiffReport {
  const schemaKeyList = schema.entries.map((e) => e.key);
  const schemaKeys = new Set(schemaKeyList);
  const scannedKeySet = new Set(scannerRefs.map((r) => r.key));
  const ignoredKeys = new Set(options.ignoreKeys || []);

  // 1. Example drift — same rule the sync/check commands use, shared via one impl.
  const { missing, extra } = computeKeyDrift(schemaKeyList, exampleKeys, ignoredKeys);

  const report: DiffReport = {
    exampleDrift: {
      missingInExample: missing,
      extraInExample: extra,
    },
    orphanedRefs: [],
    unusedSchemaKeys: [],
  };

  // 2. Orphaned References
  for (const ref of scannerRefs) {
    if (!schemaKeys.has(ref.key) && !ignoredKeys.has(ref.key)) {
      report.orphanedRefs.push(ref);
    }
  }

  // 3. Unused Schema Keys (Strict mode)
  if (options.strict) {
    for (const key of schemaKeys) {
      if (!scannedKeySet.has(key) && !ignoredKeys.has(key)) {
        report.unusedSchemaKeys.push(key);
      }
    }
  }

  return report;
}

/**
 * The single source of truth for example-file drift: which schema keys are
 * missing from a set of present keys, and which present keys are not in the
 * schema. Both `sync` and `check` call this so the rule can never diverge.
 */
export function computeKeyDrift(
  schemaKeys: string[],
  presentKeys: string[],
  ignore: ReadonlySet<string>,
): { missing: string[]; extra: string[] } {
  const present = new Set(presentKeys);
  const schema = new Set(schemaKeys);
  return {
    missing: schemaKeys.filter((k) => !present.has(k) && !ignore.has(k)),
    extra: [...present].filter((k) => !schema.has(k) && !ignore.has(k)),
  };
}

export function parseEnvKeys(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      // Support `export KEY=value` in addition to plain `KEY=value`.
      const withoutExport = line.startsWith("export ") ? line.slice("export ".length) : line;
      return withoutExport.split("=")[0]!.trim();
    });
}
