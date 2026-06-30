import pc from "picocolors";
import path from "node:path";
import { scanSource } from "../core/scan-source.js";
import { loadSchema } from "../core/load-schema.js";
import { diff } from "../core/diff.js";
import { findWorkspacePackages } from "../utils/workspace.js";
import { resolveConfig } from "../config.js";
import { findSchemaFile } from "../utils/file.js";
import { formatJsonScan } from "../reporters/json.js";
import { reportScan } from "../reporters/pretty.js";
import { toError } from "../utils/errors.js";
import { makeLogger } from "../utils/logger.js";
import { makeDebug } from "../utils/debug.js";
import { ExitCode } from "../utils/exit-code.js";
import type { Config } from "../config.js";
import type { ScanReportData } from "../reporters/types.js";

export async function runScan(
  options: {
    strict?: boolean;
    json?: boolean;
    workspace?: boolean;
    cwd?: string;
    schema?: string;
    include?: string[] | undefined;
    exclude?: string[] | undefined;
    silent?: boolean;
    debug?: boolean;
    _internal?: boolean;
  },
  config: Config = {},
): Promise<{ code: ExitCode; data?: ScanReportData | ScanReportData[] }> {
  const cwd = options.cwd || process.cwd();
  const isWorkspace = options.workspace;
  const logger = makeLogger({ json: options.json, silent: options.silent });
  const dbg = makeDebug(options.debug);

  try {
    if (isWorkspace) {
      const packages = await findWorkspacePackages(cwd);
      if (packages.length === 0) {
        logger.info(pc.yellow("No workspace packages found."));
        return { code: ExitCode.Ok, data: [] };
      }

      logger.info(pc.cyan(`Scanning ${packages.length} packages in workspace...`));
      dbg.log(`scan: ${packages.length} workspace packages`);

      const allReports: ScanReportData[] = [];
      let hasErrors = false;

      for (const pkg of packages) {
        const pkgConfig = await resolveConfig(pkg.dir);
        const schemaPath = options.schema
          ? path.resolve(cwd, options.schema)
          : pkgConfig.schema
            ? path.resolve(pkg.dir, pkgConfig.schema)
            : await findSchemaFile(pkg.dir);
        const rootDir = pkgConfig.rootDir
          ? path.resolve(pkg.dir, pkgConfig.rootDir)
          : path.join(pkg.dir, "src");

        const include = options.include || pkgConfig.scan?.include;
        const exclude = options.exclude || pkgConfig.scan?.exclude;
        const scanOptions: { include?: string[]; exclude?: string[]; cwd?: string } = {
          cwd: pkg.dir,
        };
        if (include) scanOptions.include = include;
        if (exclude) scanOptions.exclude = exclude;

        try {
          const [schema, report] = await Promise.all([
            loadSchema(schemaPath),
            scanSource(rootDir, scanOptions),
          ]);

          const result = diff(schema, [], report.references, {
            strict: options.strict !== undefined ? options.strict : false,
            ignoreKeys: pkgConfig.ignoreKeys || [],
          });

          allReports.push({
            package: pkg.dir,
            rootDir,
            orphanedRefs: result.orphanedRefs,
            unusedSchemaKeys: result.unusedSchemaKeys,
            dynamicRefs: report.dynamic,
            warnings: report.warnings,
          });

          if (
            result.orphanedRefs.length > 0 ||
            (options.strict && result.unusedSchemaKeys.length > 0)
          ) {
            hasErrors = true;
          }
        } catch (e: unknown) {
          allReports.push({
            package: pkg.dir,
            rootDir,
            orphanedRefs: [],
            unusedSchemaKeys: [],
            dynamicRefs: [],
            warnings: [],
            error: toError(e).message,
          });
          hasErrors = true;
        }
      }

      if (options.json && !options._internal) {
        logger.output(formatJsonScan(allReports));
      } else if (!options.json && !options.silent) {
        reportScan(allReports, { strict: options.strict }, logger);
      }

      return { code: hasErrors ? ExitCode.Drift : ExitCode.Ok, data: allReports };
    }

    // Single mode
    const schemaPath = options.schema
      ? path.resolve(cwd, options.schema)
      : config.schema
        ? path.resolve(cwd, config.schema)
        : await findSchemaFile(cwd);
    const rootDir = config.rootDir ? path.resolve(cwd, config.rootDir) : path.join(cwd, "src");

    const include = options.include || config.scan?.include;
    const exclude = options.exclude || config.scan?.exclude;
    const scanOptions: { include?: string[]; exclude?: string[]; cwd?: string } = { cwd };
    if (include) scanOptions.include = include;
    if (exclude) scanOptions.exclude = exclude;

    logger.info(pc.cyan(`Scanning source in ${rootDir}...`));
    dbg.log(`scan: schema=${schemaPath}`);
    dbg.log(`scan: rootDir=${rootDir}`);

    const done = dbg.timer("scan: loadSchema + scanSource");
    const [schema, report] = await Promise.all([
      loadSchema(schemaPath),
      scanSource(rootDir, scanOptions),
    ]);
    done();
    dbg.log(
      `scan: ${schema.entries.length} schema keys, ${report.references.length} refs, ` +
        `${report.dynamic.length} dynamic, ${report.warnings.length} warnings`,
    );

    const result = diff(schema, [], report.references, {
      strict: options.strict !== undefined ? options.strict : false,
      ignoreKeys: config.ignoreKeys || [],
    });

    const data: ScanReportData = {
      rootDir,
      orphanedRefs: result.orphanedRefs,
      unusedSchemaKeys: result.unusedSchemaKeys,
      dynamicRefs: report.dynamic,
      warnings: report.warnings,
    };

    if (options.json && !options._internal) {
      logger.output(formatJsonScan(data));
    } else if (!options.json && !options.silent) {
      reportScan(data, { strict: options.strict }, logger);
    }

    const hasErrors =
      result.orphanedRefs.length > 0 || (options.strict && result.unusedSchemaKeys.length > 0);
    return { code: hasErrors ? ExitCode.Drift : ExitCode.Ok, data };
  } catch (error: unknown) {
    const message = toError(error).message;
    const errorData: ScanReportData = {
      rootDir: cwd,
      orphanedRefs: [],
      unusedSchemaKeys: [],
      dynamicRefs: [],
      warnings: [],
      error: message,
    };

    if (options.json && !options._internal) {
      logger.output(formatJsonScan(errorData));
    } else if (!options.json && !options.silent) {
      logger.error(pc.red(`✖ Scan failed: ${message}`));
    }
    return { code: ExitCode.RuntimeError, data: errorData };
  }
}
