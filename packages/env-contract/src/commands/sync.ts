import fs from "node:fs/promises";
import path from "node:path";
import pc from "picocolors";
import { loadSchema } from "../core/load-schema.js";
import { generateExample } from "../core/generate-example.js";
import { injectIntoContent, extractManagedContent } from "../utils/managed-block.js";
import { parseEnvKeys } from "../core/diff.js";
import { findWorkspacePackages } from "../utils/workspace.js";
import { confirm } from "../utils/prompt.js";
import { showDiff } from "../utils/diff.js";
import { writeAtomically, findSchemaFile } from "../utils/file.js";
import { resolveConfig } from "../config.js";
import type { Config } from "../config.js";
import { formatJsonSync } from "../reporters/json.js";
import { reportSync } from "../reporters/pretty.js";
import type { SyncReport } from "../reporters/types.js";

export async function runSync(
  options: { target?: string; yes?: boolean; check?: boolean; watch?: boolean; workspace?: boolean; silent?: boolean; cwd?: string; schema?: string; json?: boolean },
  config: Config = {}
): Promise<{ code: number; data?: any }> {
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
    const schemasToWatch: { path: string, pkgDir: string, targetExampleFile: string, config: Config }[] = [];
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
      
      for (const target of schemasToWatch) {
        try {
          const watcher = fs.watch(target.path);
          let timeoutId: NodeJS.Timeout | null = null;
          for await (const event of watcher) {
            if (event.eventType === 'change') {
              if (timeoutId) clearTimeout(timeoutId);
              timeoutId = setTimeout(async () => {
                const { report, canceled } = await executeSync(target.path, target.targetExampleFile, options, target.config, target.pkgDir);
                if (!options.silent && !canceled) {
                  reportSync(report, { check: options.check });
                }
              }, 200);
            }
          }
        } catch (error: any) {
          if (!options.silent) console.error(pc.red(`✖ Failed to watch file ${target.path}: ${error.message}`));
        }
      }
      return { code: hasRuntimeError ? 2 : (hasDrift ? 1 : 0), data: allReports };
    }

    return { code: hasRuntimeError ? 2 : (hasDrift ? 1 : 0), data: allReports };
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
    
    try {
      const watcher = fs.watch(schemaPath);
      let timeoutId: NodeJS.Timeout | null = null;

      for await (const event of watcher) {
        if (event.eventType === 'change') {
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(async () => {
            const { report: watchReport, canceled: watchCanceled } = await executeSync(schemaPath, exampleFile, options, config);
            if (!options.silent && !watchCanceled) {
              reportSync(watchReport, { check: options.check });
            }
          }, 200);
        }
      }
    } catch (error: any) {
      const errReport: SyncReport = {
        exampleFile,
        syncDrift: false,
        missingInExample: [],
        extraInExample: [],
        ignoredKeys: config.ignoreKeys || [],
        error: error.message,
      };
      if (options.json) {
        console.log(formatJsonSync(errReport));
      } else if (!options.silent) {
        reportSync(errReport, { check: options.check });
      }
      return { code: 2, data: errReport };
    }
  }

  return { code, data: report };
}

async function executeSync(
  schemaPath: string,
  exampleFile: string,
  options: any,
  config: Config = {},
  pkgDir?: string
): Promise<{ code: number; report: SyncReport; canceled?: boolean }> {
  const ignoredKeys = config.ignoreKeys || [];
  try {
    const schema = await loadSchema(schemaPath);
    const newManagedContent = generateExample(schema);

    let existingContent = "";
    try {
      existingContent = await fs.readFile(exampleFile, "utf-8");
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }

    const relativeSchemaPath = path.relative(options.cwd || process.cwd(), schemaPath);
    const updatedContent = injectIntoContent(existingContent, newManagedContent, relativeSchemaPath);

    // Parse existing managed keys and schema keys
    const managedContent = extractManagedContent(existingContent);
    const existingManagedKeys = managedContent ? parseEnvKeys(managedContent) : [];
    
    const schemaKeys = schema.entries.map((e) => e.key);
    const ignoredKeysSet = new Set(ignoredKeys);

    const existingManagedKeySet = new Set(existingManagedKeys);
    const schemaKeySet = new Set(schemaKeys);

    const missingInExample: string[] = [];
    const extraInExample: string[] = [];

    for (const key of schemaKeys) {
      if (!existingManagedKeySet.has(key) && !ignoredKeysSet.has(key)) {
        missingInExample.push(key);
      }
    }

    const uniqueExistingManagedKeys = Array.from(existingManagedKeySet);
    for (const key of uniqueExistingManagedKeys) {
      if (!schemaKeySet.has(key) && !ignoredKeysSet.has(key)) {
        extraInExample.push(key);
      }
    }

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
  } catch (error: any) {
    return {
      code: 2,
      report: {
        package: pkgDir,
        exampleFile,
        syncDrift: false,
        missingInExample: [],
        extraInExample: [],
        ignoredKeys,
        error: error.message,
      },
    };
  }
}
