import fs from "node:fs/promises";
import path from "node:path";
import pc from "picocolors";
import { loadSchema } from "../core/load-schema.js";
import { generateExample } from "../core/generate-example.js";
import { injectIntoContent, extractManagedContent } from "../utils/managed-block.js";
import { parseEnvKeys, computeKeyDrift } from "../core/diff.js";
import { findWorkspacePackages } from "../utils/workspace.js";
import { confirm } from "../utils/prompt.js";
import { showDiff } from "../utils/diff.js";
import { writeAtomically, findSchemaFile } from "../utils/file.js";
import { resolveConfig } from "../config.js";
import type { Config } from "../config.js";
import { toError, errorCode } from "../utils/errors.js";
import { formatJsonSync } from "../reporters/json.js";
import { reportSync } from "../reporters/pretty.js";
import type { SyncReport } from "../reporters/types.js";

export interface SyncRunOptions {
  target?: string;
  yes?: boolean;
  check?: boolean;
  watch?: boolean;
  workspace?: boolean;
  silent?: boolean;
  cwd?: string;
  schema?: string;
  json?: boolean;
}

export async function runSync(
  options: SyncRunOptions,
  config: Config = {},
): Promise<{ code: number; data?: SyncReport | SyncReport[] }> {
  const cwd = options.cwd || process.cwd();
  const isWorkspace = options.workspace;

  if (isWorkspace) {
    const packages = await findWorkspacePackages(cwd);
    if (packages.length === 0) {
      if (options.json) {
        console.log(formatJsonSync([]));
      } else if (!options.silent) {
        console.log(pc.yellow("No workspace packages found."));
      }
      return { code: 0, data: [] };
    }

    let hasDrift = false;
    let hasRuntimeError = false;
    const schemasToWatch: { path: string; pkgDir: string; targetExampleFile: string; config: Config }[] = [];
    const allReports: SyncReport[] = [];
    const reportsToPrint: SyncReport[] = [];

    if (!options.json && !options.silent) {
      console.log(pc.cyan(`Found ${packages.length} packages in workspace.`));
    }

    for (const pkg of packages) {
      const pkgConfig = await resolveConfig(pkg.dir);

      const schemaPath = options.schema ? path.resolve(cwd, options.schema) : (pkgConfig.schema ? path.resolve(pkg.dir, pkgConfig.schema) : await findSchemaFile(pkg.dir));
      const exampleFile = options.target ? path.resolve(cwd, options.target) : (pkgConfig.exampleFile ? path.resolve(pkg.dir, pkgConfig.exampleFile) : path.join(pkg.dir, ".env.example"));

      const { code, report, canceled } = await executeSync(schemaPath, exampleFile, options, pkgConfig, pkg.dir);
      if (code === 1) hasDrift = true;
      if (code === 2) hasRuntimeError = true;

      allReports.push(report);
      if (!canceled) {
        reportsToPrint.push(report);
      }

      schemasToWatch.push({ path: schemaPath, pkgDir: pkg.dir, targetExampleFile: exampleFile, config: pkgConfig });
    }

    if (options.json) {
      console.log(formatJsonSync(allReports));
    } else if (!options.silent) {
      reportSync(reportsToPrint, { check: options.check });
    }

    if (options.watch) {
      if (!options.silent) console.log(pc.cyan(`\nWatching ${schemasToWatch.length} schemas for changes...`));
      // Start every watcher concurrently. Previously these were awaited inside a
      // `for` loop, so the first `for await (...watcher)` never returned and only
      // the first package's schema was ever actually watched.
      await Promise.all(
        schemasToWatch.map((t) => watchSchema(t.path, t.targetExampleFile, options, t.config, t.pkgDir)),
      );
    }

    return { code: hasRuntimeError ? 2 : hasDrift ? 1 : 0, data: allReports };
  }

  // Single mode
  const schemaPath = options.schema ? path.resolve(cwd, options.schema) : (config.schema ? path.resolve(cwd, config.schema) : await findSchemaFile(cwd));
  const exampleFile = options.target ? path.resolve(cwd, options.target) : (config.exampleFile ? path.resolve(cwd, config.exampleFile) : path.resolve(cwd, ".env.example"));

  const { code, report, canceled } = await executeSync(schemaPath, exampleFile, options, config);

  if (options.json) {
    console.log(formatJsonSync(report));
  } else if (!options.silent && !canceled) {
    reportSync(report, { check: options.check });
  }

  if (options.watch) {
    if (!options.silent) console.log(pc.cyan(`\nWatching ${schemaPath} for changes...`));
    await watchSchema(schemaPath, exampleFile, options, config);
  }

  return { code, data: report };
}

/**
 * Watch a single schema file and re-sync (debounced) on change. Errors are
 * reported but never rejected, so a caller can watch many schemas concurrently
 * with `Promise.all`.
 */
async function watchSchema(
  schemaPath: string,
  exampleFile: string,
  options: SyncRunOptions,
  config: Config,
  pkgDir?: string,
): Promise<void> {
  let timeoutId: NodeJS.Timeout | null = null;
  try {
    const watcher = fs.watch(schemaPath);
    for await (const event of watcher) {
      if (event.eventType === "change") {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          void (async () => {
            try {
              const { report, canceled } = await executeSync(schemaPath, exampleFile, options, config, pkgDir);
              if (!options.silent && !canceled) {
                reportSync(report, { check: options.check });
              }
            } catch (error) {
              if (!options.silent) {
                console.error(pc.red(`✖ Sync failed for ${schemaPath}: ${toError(error).message}`));
              }
            }
          })();
        }, 200);
      }
    }
  } catch (error) {
    if (!options.silent) {
      console.error(pc.red(`✖ Failed to watch file ${schemaPath}: ${toError(error).message}`));
    }
  }
}

async function executeSync(
  schemaPath: string,
  exampleFile: string,
  options: SyncRunOptions,
  config: Config = {},
  pkgDir?: string,
): Promise<{ code: number; report: SyncReport; canceled?: boolean }> {
  const ignoredKeys = config.ignoreKeys || [];
  try {
    const schema = await loadSchema(schemaPath);
    const newManagedContent = generateExample(schema);

    let existingContent = "";
    try {
      existingContent = await fs.readFile(exampleFile, "utf-8");
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
    }

    const relativeSchemaPath = path.relative(options.cwd || process.cwd(), schemaPath);
    const updatedContent = injectIntoContent(existingContent, newManagedContent, relativeSchemaPath);

    // Parse existing managed keys and schema keys
    const managedContent = extractManagedContent(existingContent);
    const existingManagedKeys = managedContent ? parseEnvKeys(managedContent) : [];

    const schemaKeys = schema.entries.map((e) => e.key);
    const ignoredKeysSet = new Set(ignoredKeys);

    const { missing: missingInExample, extra: extraInExample } = computeKeyDrift(
      schemaKeys,
      existingManagedKeys,
      ignoredKeysSet,
    );

    const syncDrift = updatedContent !== existingContent;

    const report: SyncReport = {
      package: pkgDir,
      exampleFile,
      syncDrift,
      missingInExample,
      extraInExample,
      ignoredKeys,
    };

    if (!syncDrift) {
      return { code: 0, report };
    }

    if (options.check) {
      return { code: 1, report };
    }

    if (!options.yes && !options.json && !options.silent) {
      console.log(pc.yellow(`\nDrift detected in ${exampleFile}.`));
      showDiff(existingContent, updatedContent);
      const accepted = await confirm(pc.cyan(`Apply these changes to ${exampleFile}? (y/N)`));
      if (!accepted) {
        console.log(pc.gray("Canceled by user."));
        return { code: 0, report, canceled: true };
      }
    }

    await writeAtomically(exampleFile, updatedContent);
    return { code: 0, report };
  } catch (error) {
    return {
      code: 2,
      report: {
        package: pkgDir,
        exampleFile,
        syncDrift: false,
        missingInExample: [],
        extraInExample: [],
        ignoredKeys,
        error: toError(error).message,
      },
    };
  }
}
