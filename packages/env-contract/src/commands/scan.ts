import pc from "picocolors";
import { scanSource } from "../core/scan-source.js";
import { loadSchema } from "../core/load-schema.js";
import { diff } from "../core/diff.js";
import type { Config } from "../config.js";

export async function runScan(options: { strict?: boolean; json?: boolean }, config: Config = {}) {
  const schemaPath = config.schema || "src/env.ts";
  const rootDir = config.rootDir || "src";

  try {
    if (!options.json) {
      console.log(pc.cyan(`Scanning source in ${rootDir}...`));
    }
    const [schema, report] = await Promise.all([
      loadSchema(schemaPath),
      scanSource(rootDir),
    ]);

    const result = diff(schema, [], report.references, { strict: options.strict });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return (result.orphanedRefs.length === 0 && (!options.strict || result.unusedSchemaKeys.length === 0)) ? 0 : 1;
    }

    if (result.orphanedRefs.length === 0 && report.dynamic.length === 0 && (!options.strict || result.unusedSchemaKeys.length === 0)) {
      console.log(pc.green("✔ No environment contract violations found in code."));
      return 0;
    }

    if (result.orphanedRefs.length > 0) {
      console.log(pc.yellow(`\nFound ${result.orphanedRefs.length} orphaned references (not in schema):`));
      for (const ref of result.orphanedRefs) {
        console.log(`  ${pc.red(ref.key)} ${pc.gray(`at ${ref.file}:${ref.line}:${ref.column}`)}`);
      }
    }

    if (report.dynamic.length > 0) {
      console.log(pc.yellow(`\nFound ${report.dynamic.length} dynamic accesses (cannot be statically verified):`));
      for (const d of report.dynamic) {
        console.log(`  ${pc.gray(`${d.file}:${d.line}`)} ${pc.red(d.snippet)}`);
      }
    }

    if (options.strict && result.unusedSchemaKeys.length > 0) {
      console.log(pc.yellow(`\nFound ${result.unusedSchemaKeys.length} unused schema entries:`));
      for (const key of result.unusedSchemaKeys) {
        console.log(`  ${pc.red(key)}`);
      }
    }

    return 1;
  } catch (error: any) {
    if (options.json) {
      console.log(JSON.stringify({ error: error.message }));
    } else {
      console.error(pc.red(`✖ Scan failed: ${error.message}`));
    }
    return 2;
  }
}
