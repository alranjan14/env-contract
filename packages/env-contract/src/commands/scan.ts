import pc from "picocolors";
import path from "node:path";
import { scanSource } from "../core/scan-source.js";
import { loadSchema } from "../core/load-schema.js";
import { diff } from "../core/diff.js";
import { findWorkspacePackages } from "../utils/workspace.js";
import { resolveConfig } from "../config.js";
import type { Config } from "../config.js";

export async function runScan(
  options: { strict?: boolean; json?: boolean; workspace?: boolean; cwd?: string; schema?: string; include?: string[]; exclude?: string[] },
  config: Config = {}
) {
  const cwd = options.cwd || process.cwd();
  const isWorkspace = options.workspace;

  try {
    if (isWorkspace) {
      const packages = await findWorkspacePackages(cwd);
      if (packages.length === 0) {
        if (!options.json) console.log(pc.yellow("No workspace packages found."));
        return 0;
      }

      if (!options.json) console.log(pc.cyan(`Scanning ${packages.length} packages in workspace...`));

      const allReports = [];
      let hasErrors = false;

      for (const pkg of packages) {
        const pkgConfig = await resolveConfig(pkg.dir);
        
        const schemaPath = options.schema ? path.resolve(cwd, options.schema) : (pkgConfig.schema ? path.resolve(pkg.dir, pkgConfig.schema) : path.join(pkg.dir, "src/env.ts"));
        const rootDir = pkgConfig.rootDir ? path.resolve(pkg.dir, pkgConfig.rootDir) : path.join(pkg.dir, "src");
        const include = options.include || pkgConfig.scan?.include;
        const exclude = options.exclude || pkgConfig.scan?.exclude;

        try {
          const [schema, report] = await Promise.all([
            loadSchema(schemaPath),
            scanSource(rootDir, { include, exclude }),
          ]);

          const result = diff(schema, [], report.references, {
            ...(options.strict !== undefined ? { strict: options.strict } : {}),
            ignoreKeys: pkgConfig.ignoreKeys,
          });

          allReports.push({ package: pkg.dir, result, report });

          if (result.orphanedRefs.length > 0 || (!options.strict && result.unusedSchemaKeys.length > 0 && options.strict) || (options.strict && result.unusedSchemaKeys.length > 0)) {
            hasErrors = true;
          }
        } catch (e: any) {
          allReports.push({ package: pkg.dir, error: e.message });
          hasErrors = true;
        }
      }

      if (options.json) {
        console.log(JSON.stringify(allReports, null, 2));
        return hasErrors ? 1 : 0;
      }

      let printedErrors = false;
      for (const rep of allReports) {
        if (rep.error) {
          console.error(pc.red(`✖ Scan failed for ${rep.package}: ${rep.error}`));
          printedErrors = true;
          continue;
        }
        const { result, report } = rep;
        if (result.orphanedRefs.length > 0 || report.dynamic.length > 0 || (options.strict && result.unusedSchemaKeys.length > 0)) {
          console.log(pc.magenta(`\n📦 ${rep.package}`));
          printedErrors = true;
          
          if (result.orphanedRefs.length > 0) {
            console.log(pc.yellow(`Found ${result.orphanedRefs.length} orphaned references (not in schema):`));
            for (const ref of result.orphanedRefs) {
              console.log(`  ${pc.red(ref.key)} ${pc.gray(`at ${ref.file}:${ref.line}:${ref.column}`)}`);
            }
          }
          if (report.dynamic.length > 0) {
            console.log(pc.yellow(`Found ${report.dynamic.length} dynamic accesses (cannot be statically verified):`));
            for (const d of report.dynamic) {
              console.log(`  ${pc.gray(`${d.file}:${d.line}`)} ${pc.red(d.snippet)}`);
            }
          }
          if (options.strict && result.unusedSchemaKeys.length > 0) {
            console.log(pc.yellow(`Found ${result.unusedSchemaKeys.length} unused schema entries:`));
            for (const key of result.unusedSchemaKeys) {
              console.log(`  ${pc.red(key)}`);
            }
          }
        }
      }

      if (!printedErrors) {
        console.log(pc.green("✔ No environment contract violations found in any workspace package."));
      }

      return hasErrors ? 1 : 0;
    }

    // Single mode
    const schemaPath = options.schema ? path.resolve(cwd, options.schema) : (config.schema ? path.resolve(cwd, config.schema) : path.join(cwd, "src/env.ts"));
    const rootDir = config.rootDir ? path.resolve(cwd, config.rootDir) : path.join(cwd, "src");
    const include = options.include || config.scan?.include;
    const exclude = options.exclude || config.scan?.exclude;

    if (!options.json) {
      console.log(pc.cyan(`Scanning source in ${rootDir}...`));
    }
    const [schema, report] = await Promise.all([
      loadSchema(schemaPath),
      scanSource(rootDir, { include, exclude }),
    ]);

    const result = diff(schema, [], report.references, {
      ...(options.strict !== undefined ? { strict: options.strict } : {}),
      ignoreKeys: config.ignoreKeys,
    });

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
