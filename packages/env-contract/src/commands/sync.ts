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
import { writeAtomically } from "../utils/file.js";
import { resolveConfig } from "../config.js";
import type { Config } from "../config.js";

export async function runSync(
  options: { target?: string; yes?: boolean; check?: boolean; watch?: boolean; workspace?: boolean; silent?: boolean; cwd?: string; schema?: string },
  config: Config = {}
): Promise<{ code: number; data?: any }> {
  const cwd = options.cwd || process.cwd();
  const isWorkspace = options.workspace;

  if (isWorkspace) {
    const packages = await findWorkspacePackages(cwd);
    if (packages.length === 0) {
      if (!options.silent) console.log(pc.yellow("No workspace packages found."));
      return { code: 0, data: [] };
    }

    let hasErrors = false;
    const schemasToWatch: { path: string, pkgDir: string, targetExampleFile: string, config: Config }[] = [];
    const allData: any[] = [];

    if (!options.silent) console.log(pc.cyan(`Found ${packages.length} packages in workspace.`));

    for (const pkg of packages) {
      const pkgConfig = await resolveConfig(pkg.dir);
      
      const schemaPath = options.schema ? path.resolve(cwd, options.schema) : (pkgConfig.schema ? path.resolve(pkg.dir, pkgConfig.schema) : path.join(pkg.dir, "src/env.ts"));
      const exampleFile = options.target ? path.resolve(cwd, options.target) : (pkgConfig.exampleFile ? path.resolve(pkg.dir, pkgConfig.exampleFile) : path.join(pkg.dir, ".env.example"));

      if (!options.silent) console.log(pc.gray(`\nSyncing package: ${pkg.dir}`));
      const { code, data } = await executeSync(schemaPath, exampleFile, options, pkgConfig);
      if (code !== 0) hasErrors = true;
      allData.push({ package: pkg.dir, ...data });

      schemasToWatch.push({ path: schemaPath, pkgDir: pkg.dir, targetExampleFile: exampleFile, config: pkgConfig });
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
                if (!options.silent) console.log(pc.gray(`\nFile changed in ${target.pkgDir}. Syncing...`));
                await executeSync(target.path, target.targetExampleFile, options, target.config);
              }, 200);
            }
          }
        } catch (error: any) {
          if (!options.silent) console.error(pc.red(`✖ Failed to watch file ${target.path}: ${error.message}`));
        }
      }
      return { code: hasErrors ? 1 : 0, data: allData };
    }

    return { code: hasErrors ? 1 : 0, data: allData };
  }

  // Single mode
  const schemaPath = options.schema ? path.resolve(cwd, options.schema) : (config.schema ? path.resolve(cwd, config.schema) : path.resolve(cwd, "src/env.ts"));
  const exampleFile = options.target ? path.resolve(cwd, options.target) : (config.exampleFile ? path.resolve(cwd, config.exampleFile) : path.resolve(cwd, ".env.example"));

  const { code, data } = await executeSync(schemaPath, exampleFile, options, config);

  if (options.watch) {
    if (!options.silent) console.log(pc.cyan(`\nWatching ${schemaPath} for changes...`));
    
    try {
      const watcher = fs.watch(schemaPath);
      let timeoutId: NodeJS.Timeout | null = null;

      for await (const event of watcher) {
        if (event.eventType === 'change') {
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(async () => {
            if (!options.silent) console.log(pc.gray(`\nFile changed. Syncing...`));
            await executeSync(schemaPath, exampleFile, options, config);
          }, 200);
        }
      }
    } catch (error: any) {
      if (!options.silent) console.error(pc.red(`✖ Failed to watch file: ${error.message}`));
      return { code: 2, data: { syncDrift: false, error: error.message } };
    }
  }

  return { code, data };
}

async function executeSync(schemaPath: string, exampleFile: string, options: any, config: Config = {}): Promise<{ code: number; data: any }> {
  try {
    const schema = await loadSchema(schemaPath);
    const newManagedContent = generateExample(schema);

    let existingContent = "";
    try {
      existingContent = await fs.readFile(exampleFile, "utf-8");
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }

    const updatedContent = injectIntoContent(existingContent, newManagedContent);

    // Parse existing managed keys and schema keys
    const managedContent = extractManagedContent(existingContent);
    const existingManagedKeys = managedContent ? parseEnvKeys(managedContent) : [];
    
    const schemaKeys = schema.entries.map((e) => e.key);
    const ignoredKeys = new Set(config.ignoreKeys || []);

    const existingManagedKeySet = new Set(existingManagedKeys);
    const schemaKeySet = new Set(schemaKeys);

    const missingInExample: string[] = [];
    const extraInExample: string[] = [];

    for (const key of schemaKeys) {
      if (!existingManagedKeySet.has(key) && !ignoredKeys.has(key)) {
        missingInExample.push(key);
      }
    }

    const uniqueExistingManagedKeys = Array.from(existingManagedKeySet);
    for (const key of uniqueExistingManagedKeys) {
      if (!schemaKeySet.has(key) && !ignoredKeys.has(key)) {
        extraInExample.push(key);
      }
    }

    if (updatedContent === existingContent) {
      if (!options.watch && !options.silent) console.log(pc.green(`✔ ${exampleFile} is already up to date with the schema.`));
      return { code: 0, data: { syncDrift: false, missingInExample, extraInExample } };
    }

    if (options.check) {
      if (!options.silent) {
        console.error(pc.red(`\n✖ Drift detected in ${exampleFile}.`));
        if (missingInExample.length > 0) {
          console.error(pc.yellow(`  Missing keys in managed block:`));
          for (const key of missingInExample) {
            console.error(`    - ${pc.red(key)}`);
          }
        }
        if (extraInExample.length > 0) {
          console.error(pc.yellow(`  Extra keys in managed block (not in schema):`));
          for (const key of extraInExample) {
            console.error(`    - ${pc.red(key)}`);
          }
        }
        console.error(pc.yellow(`👉 Suggestion: Run \`env-contract sync\` to update.`));
      }
      return { code: 1, data: { syncDrift: true, missingInExample, extraInExample } };
    }

    if (!options.yes && !options.silent) {
      console.log(pc.yellow(`\nDrift detected in ${exampleFile}.`));
      showDiff(existingContent, updatedContent);
      const accepted = await confirm(pc.cyan(`Apply these changes to ${exampleFile}? (y/N)`));
      if (!accepted) {
        console.log(pc.gray("Canceled by user."));
        return { code: 0, data: { syncDrift: true, missingInExample, extraInExample } };
      }
    }

    await writeAtomically(exampleFile, updatedContent);
    if (!options.silent) console.log(pc.green(`✔ Successfully updated ${exampleFile}.`));
    return { code: 0, data: { syncDrift: true, missingInExample, extraInExample } };
  } catch (error: any) {
    if (!options.silent) console.error(pc.red(`✖ Sync failed: ${error.message}`));
    return { code: 2, data: { syncDrift: false, error: error.message } };
  }
}
