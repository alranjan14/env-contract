import pc from "picocolors";
import path from "node:path";
import { scanSource } from "../core/scan-source.js";
import { loadSchema } from "../core/load-schema.js";
import { diff } from "../core/diff.js";
import { findWorkspacePackages } from "../utils/workspace.js";
import { resolveConfig } from "../config.js";
import type { Config } from "../config.js";
import type { Reference, DynamicReference, ScanReport } from "../core/scan-source.js";
import type { DiffReport } from "../core/diff.js";

type WorkspaceReport = {
  package: string;
  orphanedRefs: Reference[];
  unusedSchemaKeys: string[];
  dynamicRefs: DynamicReference[];
  _reportRaw: ScanReport;
  _resultRaw: DiffReport;
  error?: undefined;
} | {
  package: string;
  error: string;
  orphanedRefs?: undefined;
  unusedSchemaKeys?: undefined;
  dynamicRefs?: undefined;
  _reportRaw?: undefined;
  _resultRaw?: undefined;
};

export async function runScan(
  options: { strict?: boolean; json?: boolean; workspace?: boolean; cwd?: string; schema?: string; include?: string[]; exclude?: string[]; silent?: boolean; _internal?: boolean },
  config: Config = {}
): Promise<{ code: number; data?: any }> {
  const cwd = options.cwd || process.cwd();
  const isWorkspace = options.workspace;

  try {
    if (isWorkspace) {
      const packages = await findWorkspacePackages(cwd);
      if (packages.length === 0) {
        if (!options.json && !options.silent) console.log(pc.yellow("No workspace packages found."));
        return { code: 0, data: [] };
      }

      if (!options.json && !options.silent) console.log(pc.cyan(`Scanning ${packages.length} packages in workspace...`));

      const allReports: WorkspaceReport[] = [];
      let hasErrors = false;

      for (const pkg of packages) {
        const pkgConfig = await resolveConfig(pkg.dir);
        
        const schemaPath = options.schema ? path.resolve(cwd, options.schema) : (pkgConfig.schema ? path.resolve(pkg.dir, pkgConfig.schema) : path.join(pkg.dir, "src/env.ts"));
        const rootDir = pkgConfig.rootDir ? path.resolve(pkg.dir, pkgConfig.rootDir) : path.join(pkg.dir, "src");
        const include = options.include || pkgConfig.scan?.include;

        try {
          const [schema, report] = await Promise.all([
            loadSchema(schemaPath),
            scanSource(rootDir, include),
          ]);

          const result = diff(schema, [], report.references, {
            ...(options.strict !== undefined ? { strict: options.strict } : {}),
            ...(pkgConfig.ignoreKeys !== undefined ? { ignoreKeys: pkgConfig.ignoreKeys } : {}),
          });

          const data = {
            package: pkg.dir,
            orphanedRefs: result.orphanedRefs,
            unusedSchemaKeys: result.unusedSchemaKeys,
            dynamicRefs: report.dynamic,
          };
          
          allReports.push({ ...data, _reportRaw: report, _resultRaw: result });

          if (result.orphanedRefs.length > 0 || (!options.strict && result.unusedSchemaKeys.length > 0 && options.strict) || (options.strict && result.unusedSchemaKeys.length > 0)) {
            hasErrors = true;
          }
        } catch (e: any) {
          allReports.push({ package: pkg.dir, error: e.message });
          hasErrors = true;
        }
      }

      if (options.json && !options._internal) {
        console.log(JSON.stringify(allReports.map(r => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { _reportRaw: _, _resultRaw: __, ...rest } = r;
          return rest;
        }), null, 2));
        return { code: hasErrors ? 1 : 0, data: allReports };
      }

      let printedErrors = false;
      if (!options.json && !options.silent) {
        for (const rep of allReports) {
          if (rep.error) {
            console.error(pc.red(`✖ Scan failed for ${rep.package}: ${rep.error}`));
            printedErrors = true;
            continue;
          }

          const orphanedRefs = rep.orphanedRefs!;
          const dynamicRefs = rep.dynamicRefs!;
          const unusedSchemaKeys = rep.unusedSchemaKeys!;

          if (orphanedRefs.length > 0 || dynamicRefs.length > 0 || (options.strict && unusedSchemaKeys.length > 0)) {
            console.log(pc.magenta(`\n📦 ${rep.package}`));
            printedErrors = true;
            
            if (orphanedRefs.length > 0) {
              console.log(pc.yellow(`Found ${orphanedRefs.length} orphaned references (not in schema):`));
              for (const ref of orphanedRefs) {
                console.log(`  ${pc.red(ref.key)} ${pc.gray(`at ${ref.file}:${ref.line}:${ref.column}`)}`);
              }
            }
            if (dynamicRefs.length > 0) {
              console.log(pc.yellow(`Found ${dynamicRefs.length} dynamic accesses (cannot be statically verified):`));
              for (const d of dynamicRefs) {
                console.log(`  ${pc.gray(`${d.file}:${d.line}`)} ${pc.red(d.snippet)}`);
              }
            }
            if (options.strict && unusedSchemaKeys.length > 0) {
              console.log(pc.yellow(`Found ${unusedSchemaKeys.length} unused schema entries:`));
              for (const key of unusedSchemaKeys) {
                console.log(`  ${pc.red(key)}`);
              }
            }
          }
        }

        if (!printedErrors) {
          console.log(pc.green("✔ No environment contract violations found in any workspace package."));
        }
      }

      return { code: hasErrors ? 1 : 0, data: allReports };
    }

    // Single mode
    const schemaPath = options.schema ? path.resolve(cwd, options.schema) : (config.schema ? path.resolve(cwd, config.schema) : path.join(cwd, "src/env.ts"));
    const rootDir = config.rootDir ? path.resolve(cwd, config.rootDir) : path.join(cwd, "src");
    const include = options.include || config.scan?.include;

    if (!options.json && !options.silent) {
      console.log(pc.cyan(`Scanning source in ${rootDir}...`));
    }
    const [schema, report] = await Promise.all([
      loadSchema(schemaPath),
      scanSource(rootDir, include),
    ]);

    const result = diff(schema, [], report.references, {
      ...(options.strict !== undefined ? { strict: options.strict } : {}),
      ...(config.ignoreKeys !== undefined ? { ignoreKeys: config.ignoreKeys } : {}),
    });

    const data = {
      orphanedRefs: result.orphanedRefs,
      unusedSchemaKeys: result.unusedSchemaKeys,
      dynamicRefs: report.dynamic,
    };

    if (options.json && !options._internal) {
      console.log(JSON.stringify(data, null, 2));
      return { code: (result.orphanedRefs.length === 0 && (!options.strict || result.unusedSchemaKeys.length === 0)) ? 0 : 1, data };
    }

    if (!options.json && !options.silent) {
      if (result.orphanedRefs.length === 0 && report.dynamic.length === 0 && (!options.strict || result.unusedSchemaKeys.length === 0)) {
        console.log(pc.green("✔ No environment contract violations found in code."));
        return { code: 0, data };
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
    }

    return { code: (result.orphanedRefs.length === 0 && (!options.strict || result.unusedSchemaKeys.length === 0)) ? 0 : 1, data };
  } catch (error: any) {
    if (options.json && !options._internal) {
      console.log(JSON.stringify({ error: error.message }));
    } else if (!options.json && !options.silent) {
      console.error(pc.red(`✖ Scan failed: ${error.message}`));
    }
    return { code: 2, data: { error: error.message } };
  }
}
