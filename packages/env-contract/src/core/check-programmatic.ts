import { findSchemaFile } from "../utils/file.js";
import { loadSchema } from "./load-schema.js";
import { extractManagedContent } from "../utils/managed-block.js";
import { parseEnvKeys, diff, computeKeyDrift } from "./diff.js";
import { scanSource } from "./scan-source.js";
import { resolveConfig } from "../config.js";
import fs from "node:fs/promises";
import path from "node:path";
import { errorCode } from "../utils/errors.js";
import type { Reference, DynamicReference } from "./scan-source.js";

export async function check(
  options: {
    cwd?: string | undefined;
    strict?: boolean | undefined;
    schema?: string | undefined;
  } = {},
): Promise<{
  ok: boolean;
  exampleDrift: {
    missingInExample: string[];
    extraInExample: string[];
  };
  orphanedRefs: Reference[];
  unusedSchemaKeys: string[];
  dynamicRefs: DynamicReference[];
  warnings: Array<{ file: string; message: string }>;
}> {
  const cwd = options.cwd || process.cwd();
  const config = await resolveConfig(cwd);

  const schemaPath = options.schema
    ? path.resolve(cwd, options.schema)
    : config.schema
      ? path.resolve(cwd, config.schema)
      : await findSchemaFile(cwd);

  const schema = await loadSchema(schemaPath);

  // 1. Sync check
  const exampleFile = config.exampleFile
    ? path.resolve(cwd, config.exampleFile)
    : path.resolve(cwd, ".env.example");

  let existingContent = "";
  try {
    existingContent = await fs.readFile(exampleFile, "utf-8");
  } catch (e: unknown) {
    if (errorCode(e) !== "ENOENT") throw e;
  }

  const managedContent = extractManagedContent(existingContent);
  const existingManagedKeys = managedContent ? parseEnvKeys(managedContent) : [];
  const schemaKeys = schema.entries.map((e) => e.key);
  const ignoredKeys = new Set(config.ignoreKeys || []);

  const { missing: missingInExample, extra: extraInExample } = computeKeyDrift(
    schemaKeys,
    existingManagedKeys,
    ignoredKeys,
  );

  const hasSyncDrift = missingInExample.length > 0 || extraInExample.length > 0;

  // 2. Scan check
  const rootDir = config.rootDir ? path.resolve(cwd, config.rootDir) : path.join(cwd, "src");
  const include = config.scan?.include;
  const exclude = config.scan?.exclude;
  const scanOptions: { include?: string[]; exclude?: string[]; cwd?: string } = { cwd };
  if (include) scanOptions.include = include;
  if (exclude) scanOptions.exclude = exclude;

  const report = await scanSource(rootDir, scanOptions);

  // Example drift is already computed above via computeKeyDrift (against the
  // managed block), so pass [] here — diff() is used only for the scan-side
  // checks: orphaned refs and, under --strict, unused schema keys.
  const diffResult = diff(schema, [], report.references, {
    strict: options.strict !== undefined ? options.strict : false,
    ignoreKeys: config.ignoreKeys || [],
  });

  const hasScanDrift =
    diffResult.orphanedRefs.length > 0 ||
    (options.strict && diffResult.unusedSchemaKeys.length > 0);

  return {
    ok: !hasSyncDrift && !hasScanDrift,
    exampleDrift: {
      missingInExample,
      extraInExample,
    },
    orphanedRefs: diffResult.orphanedRefs,
    unusedSchemaKeys: diffResult.unusedSchemaKeys,
    dynamicRefs: report.dynamic,
    warnings: report.warnings,
  };
}
