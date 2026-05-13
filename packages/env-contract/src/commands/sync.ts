import fs from "node:fs/promises";
import pc from "picocolors";
import { loadSchema } from "../core/load-schema.js";
import { generateExample } from "../core/generate-example.js";
import { injectIntoContent } from "../utils/managed-block.js";
import type { Config } from "../config.js";

export async function runSync(options: { yes?: boolean; check?: boolean; watch?: boolean }, config: Config = {}) {
  const schemaPath = config.schema || "src/env.ts";
  const exampleFile = config.exampleFile || ".env.example";

  const executeSync = async () => {
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
        if (!options.watch) console.log(pc.green(`✔ ${exampleFile} is already up to date with the schema.`));
        return 0;
      }

      if (options.check) {
        console.error(pc.red(`✖ Drift detected in ${exampleFile}. Run \`env-contract sync\` to update.`));
        return 1;
      }

      await fs.writeFile(exampleFile, updatedContent, "utf-8");
      console.log(pc.green(`✔ Successfully updated ${exampleFile}.`));
      return 0;
    } catch (error: any) {
      console.error(pc.red(`✖ Sync failed: ${error.message}`));
      return 2;
    }
  };

  const initialCode = await executeSync();

  if (options.watch) {
    if (initialCode !== 0 && initialCode !== 2) {
      // Keep watching even if there was an initial error
    }
    console.log(pc.cyan(`\nWatching ${schemaPath} for changes...`));
    
    try {
      const watcher = fs.watch(schemaPath);
      let timeoutId: NodeJS.Timeout | null = null;

      for await (const event of watcher) {
        if (event.eventType === 'change') {
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(async () => {
            console.log(pc.gray(`\nFile changed. Syncing...`));
            await executeSync();
          }, 200);
        }
      }
    } catch (error: any) {
      console.error(pc.red(`✖ Failed to watch file: ${error.message}`));
      return 2;
    }
  }

  return initialCode;
}
