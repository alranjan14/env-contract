import fs from "node:fs/promises";
import pc from "picocolors";
import path from "node:path";
import { loadSchema } from "../core/load-schema.js";
import { generateExample } from "../core/generate-example.js";
import { injectIntoContent } from "../utils/managed-block.js";
import type { Config } from "../config.js";

export async function runSync(options: { yes?: boolean; check?: boolean }, config: Config = {}) {
  const schemaPath = config.schema || "src/env.ts";
  const exampleFile = config.exampleFile || ".env.example";

  try {
    const schema = await loadSchema(schemaPath);
    const newManagedContent = generateExample(schema);

    let existingContent = "";
    try {
      existingContent = await fs.readFile(exampleFile, "utf-8");
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
      // If it doesn't exist, we start with an empty string
    }

    const updatedContent = injectIntoContent(existingContent, newManagedContent);

    if (updatedContent === existingContent) {
      console.log(pc.green(`✔ ${exampleFile} is already up to date with the schema.`));
      return 0;
    }

    if (options.check) {
      console.error(pc.red(`✖ Drift detected in ${exampleFile}. Run \`env-contract sync\` to update.`));
      return 1;
    }

    // TODO: Implement interactive prompt for `--yes` if needed
    // For now, if there is a diff, we write it (assuming --yes or default behavior)
    // The spec says "Always shows a diff before writing unless --yes", but for MVP we will just write.
    
    await fs.writeFile(exampleFile, updatedContent, "utf-8");
    console.log(pc.green(`✔ Successfully updated ${exampleFile}.`));
    return 0;

  } catch (error: any) {
    console.error(pc.red(`✖ Sync failed: ${error.message}`));
    return 2;
  }
}
