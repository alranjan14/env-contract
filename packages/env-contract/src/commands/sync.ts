import fs from "node:fs/promises";
import path from "node:path";
import pc from "picocolors";
import { loadSchema } from "../core/load-schema.js";
import { generateExample } from "../core/generate-example.js";
import { injectIntoContent } from "../utils/managed-block.js";
import { findWorkspacePackages } from "../utils/workspace.js";
import { confirm } from "../utils/prompt.js";
import { showDiff } from "../utils/diff.js";
import { writeAtomically } from "../utils/file.js";
import { loadConfig } from "../config.js";
import type { Config } from "../config.js";

export async function runSync(options: { yes?: boolean; check?: boolean; watch?: boolean; workspace?: boolean; silent?: boolean }, config: Config = {}) {
  const isWorkspace = options.workspace;

  if (isWorkspace) {
    const packages = await findWorkspacePackages(process.cwd());
    if (packages.length === 0) {
      if (!options.silent) console.log(pc.yellow("No workspace packages found."));
      return 0;
    }

    let hasErrors = false;
    const schemasToWatch: { path: string, pkgDir: string, config: Config }[] = [];

    if (!options.silent) console.log(pc.cyan(`Found ${packages.length} packages in workspace.`));

    for (const pkg of packages) {
      // Load config for each package if it exists
      const pkgConfigPath = pkg.type === "config" ? path.join(pkg.dir, "env-contract.config.ts") : undefined;
      const pkgConfig = pkgConfigPath ? await loadConfig(pkgConfigPath) : {};
      
      const schemaPath = pkgConfig.schema ? path.resolve(pkg.dir, pkgConfig.schema) : path.join(pkg.dir, "src/env.ts");
      const exampleFile = pkgConfig.exampleFile ? path.resolve(pkg.dir, pkgConfig.exampleFile) : path.join(pkg.dir, ".env.example");

      if (!options.silent) console.log(pc.gray(`\nSyncing package: ${pkg.dir}`));
      const code = await executeSync(schemaPath, exampleFile, options, pkgConfig);
      if (code !== 0) hasErrors = true;

      schemasToWatch.push({ path: schemaPath, pkgDir: pkg.dir, config: pkgConfig });
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
                const exampleFile = target.config.exampleFile ? path.resolve(target.pkgDir, target.config.exampleFile) : path.join(target.pkgDir, ".env.example");
                await executeSync(target.path, exampleFile, options, target.config);
              }, 200);
            }
          }
        } catch (error: any) {
          if (!options.silent) console.error(pc.red(`✖ Failed to watch file ${target.path}: ${error.message}`));
        }
      }
      return hasErrors ? 1 : 0;
    }

    return hasErrors ? 1 : 0;
  }

  // Single mode
  const schemaPath = config.schema || "src/env.ts";
  const exampleFile = config.exampleFile || ".env.example";

  const initialCode = await executeSync(schemaPath, exampleFile, options, config);

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
      return 2;
    }
  }

  return initialCode;
}

async function executeSync(schemaPath: string, exampleFile: string, options: any, config: Config) {
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

    if (updatedContent === existingContent) {
      if (!options.watch && !options.silent) console.log(pc.green(`✔ ${exampleFile} is already up to date with the schema.`));
      return 0;
    }

    if (options.check) {
      if (!options.silent) console.error(pc.red(`✖ Drift detected in ${exampleFile}. Run \`env-contract sync\` to update.`));
      return 1;
    }

    if (!options.yes && !options.silent) {
      console.log(pc.yellow(`\nDrift detected in ${exampleFile}.`));
      showDiff(existingContent, updatedContent);
      const accepted = await confirm(pc.cyan(`Apply these changes to ${exampleFile}? (y/N)`));
      if (!accepted) {
        console.log(pc.gray("Canceled by user."));
        return 0;
      }
    }

    await writeAtomically(exampleFile, updatedContent);
    if (!options.silent) console.log(pc.green(`✔ Successfully updated ${exampleFile}.`));
    return 0;
  } catch (error: any) {
    if (!options.silent) console.error(pc.red(`✖ Sync failed: ${error.message}`));
    return 2;
  }
}
