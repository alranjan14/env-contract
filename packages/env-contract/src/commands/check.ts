import { check } from "../core/check-programmatic.js";
import { formatJsonCheck } from "../reporters/json.js";
import { reportCheck } from "../reporters/pretty.js";
import { findWorkspacePackages } from "../utils/workspace.js";
import type { Config } from "../config.js";
import type { CheckReport, PackageCheckReport } from "../reporters/types.js";

export async function runCheck(
  options: { strict?: boolean; json?: boolean; workspace?: boolean; cwd?: string; schema?: string },
  _config: Config = {}
): Promise<{ code: number }> {
  const cwd = options.cwd || process.cwd();
  
  let checkReport: CheckReport;

  if (options.workspace) {
    const packages = await findWorkspacePackages(cwd);
    const packageReports: PackageCheckReport[] = [];
    let ok = true;

    for (const pkg of packages) {
      try {
        const pkgReport = await check({
          cwd: pkg.dir,
          strict: options.strict,
          schema: options.schema
        });

        if (!pkgReport.ok) ok = false;

        packageReports.push({
          package: pkg.dir,
          syncDrift: pkgReport.exampleDrift.missingInExample.length > 0 || pkgReport.exampleDrift.extraInExample.length > 0,
          exampleDrift: pkgReport.exampleDrift,
          orphanedRefs: pkgReport.orphanedRefs,
          unusedSchemaKeys: pkgReport.unusedSchemaKeys,
          dynamicRefs: pkgReport.dynamicRefs,
          warnings: pkgReport.warnings,
        });
      } catch (error: any) {
        ok = false;
        packageReports.push({
          package: pkg.dir,
          syncDrift: false,
          exampleDrift: { missingInExample: [], extraInExample: [] },
          orphanedRefs: [],
          unusedSchemaKeys: [],
          dynamicRefs: [],
          warnings: [],
          error: error.message,
        });
      }
    }

    checkReport = {
      ok,
      workspace: true,
      packages: packageReports,
    };
  } else {
    try {
      const pkgReport = await check({
        cwd,
        strict: options.strict,
        schema: options.schema
      });

      checkReport = {
        ok: pkgReport.ok,
        workspace: false,
        packages: [{
          package: cwd,
          syncDrift: pkgReport.exampleDrift.missingInExample.length > 0 || pkgReport.exampleDrift.extraInExample.length > 0,
          exampleDrift: pkgReport.exampleDrift,
          orphanedRefs: pkgReport.orphanedRefs,
          unusedSchemaKeys: pkgReport.unusedSchemaKeys,
          dynamicRefs: pkgReport.dynamicRefs,
          warnings: pkgReport.warnings,
        }],
      };
    } catch (error: any) {
      checkReport = {
        ok: false,
        workspace: false,
        packages: [{
          package: cwd,
          syncDrift: false,
          exampleDrift: { missingInExample: [], extraInExample: [] },
          orphanedRefs: [],
          unusedSchemaKeys: [],
          dynamicRefs: [],
          warnings: [],
          error: error.message,
        }],
      };
    }
  }

  if (options.json) {
    console.log(formatJsonCheck(checkReport));
  } else {
    reportCheck(checkReport, { strict: options.strict });
  }

  const hasRuntimeError = checkReport.packages.some(p => p.error !== undefined);
  if (hasRuntimeError) {
    return { code: 2 };
  }

  return { code: checkReport.ok ? 0 : 1 };
}
