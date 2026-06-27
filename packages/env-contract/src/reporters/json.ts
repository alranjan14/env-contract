import type { CheckReport, SyncReport, ScanReportData } from "./types.js";

export function formatJsonCheck(report: CheckReport): string {
  if (report.workspace) {
    return JSON.stringify(
      report.packages.map((pkg) => ({
        package: pkg.package,
        syncDrift: pkg.syncDrift,
        exampleDrift: pkg.exampleDrift,
        orphanedRefs: pkg.orphanedRefs,
        unusedSchemaKeys: pkg.unusedSchemaKeys,
        dynamicRefs: pkg.dynamicRefs,
        warnings: pkg.warnings,
        ...(pkg.error ? { error: pkg.error } : {}),
      })),
      null,
      2,
    );
  } else {
    const pkg = report.packages[0];
    if (!pkg) return JSON.stringify({}, null, 2);
    return JSON.stringify(
      {
        syncDrift: pkg.syncDrift,
        exampleDrift: pkg.exampleDrift,
        orphanedRefs: pkg.orphanedRefs,
        unusedSchemaKeys: pkg.unusedSchemaKeys,
        dynamicRefs: pkg.dynamicRefs,
        warnings: pkg.warnings,
        ...(pkg.error ? { error: pkg.error } : {}),
      },
      null,
      2,
    );
  }
}

export function formatJsonSync(reports: SyncReport | SyncReport[]): string {
  if (Array.isArray(reports)) {
    return JSON.stringify(
      reports.map((r) => ({
        package: r.package,
        syncDrift: r.syncDrift,
        missingInExample: r.missingInExample,
        extraInExample: r.extraInExample,
        ...(r.error ? { error: r.error } : {}),
      })),
      null,
      2,
    );
  } else {
    return JSON.stringify(
      {
        syncDrift: reports.syncDrift,
        missingInExample: reports.missingInExample,
        extraInExample: reports.extraInExample,
        ...(reports.error ? { error: reports.error } : {}),
      },
      null,
      2,
    );
  }
}

export function formatJsonScan(reports: ScanReportData | ScanReportData[]): string {
  if (Array.isArray(reports)) {
    return JSON.stringify(
      reports.map((r) => ({
        package: r.package,
        orphanedRefs: r.orphanedRefs,
        unusedSchemaKeys: r.unusedSchemaKeys,
        dynamicRefs: r.dynamicRefs,
        warnings: r.warnings,
        ...(r.error ? { error: r.error } : {}),
      })),
      null,
      2,
    );
  } else {
    return JSON.stringify(
      {
        orphanedRefs: reports.orphanedRefs,
        unusedSchemaKeys: reports.unusedSchemaKeys,
        dynamicRefs: reports.dynamicRefs,
        warnings: reports.warnings,
        ...(reports.error ? { error: reports.error } : {}),
      },
      null,
      2,
    );
  }
}
