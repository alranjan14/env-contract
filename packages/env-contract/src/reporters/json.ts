import type { CheckReport, SyncReport, ScanReportData } from "./types.js";

/**
 * Version of the `--json` output shape. Bumped on any backward-incompatible
 * change so downstream parsers (CI scripts, dashboards) can detect and adapt.
 * Every `--json` payload carries this as a top-level `schemaVersion` field.
 */
export const JSON_SCHEMA_VERSION = 1;

/** Wrap a single-target result, stamping the schema version at the top level. */
function envelope(payload: Record<string, unknown>): string {
  return JSON.stringify({ schemaVersion: JSON_SCHEMA_VERSION, ...payload }, null, 2);
}

/** Wrap a workspace result: a versioned object with the per-package list. */
function envelopeList(packages: unknown[]): string {
  return JSON.stringify({ schemaVersion: JSON_SCHEMA_VERSION, packages }, null, 2);
}

export function formatJsonCheck(report: CheckReport): string {
  if (report.workspace) {
    return envelopeList(
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
    );
  } else {
    const pkg = report.packages[0];
    if (!pkg) return envelope({});
    return envelope({
      syncDrift: pkg.syncDrift,
      exampleDrift: pkg.exampleDrift,
      orphanedRefs: pkg.orphanedRefs,
      unusedSchemaKeys: pkg.unusedSchemaKeys,
      dynamicRefs: pkg.dynamicRefs,
      warnings: pkg.warnings,
      ...(pkg.error ? { error: pkg.error } : {}),
    });
  }
}

export function formatJsonSync(reports: SyncReport | SyncReport[]): string {
  if (Array.isArray(reports)) {
    return envelopeList(
      reports.map((r) => ({
        package: r.package,
        syncDrift: r.syncDrift,
        missingInExample: r.missingInExample,
        extraInExample: r.extraInExample,
        ...(r.error ? { error: r.error } : {}),
      })),
    );
  } else {
    return envelope({
      syncDrift: reports.syncDrift,
      missingInExample: reports.missingInExample,
      extraInExample: reports.extraInExample,
      ...(reports.error ? { error: reports.error } : {}),
    });
  }
}

export function formatJsonScan(reports: ScanReportData | ScanReportData[]): string {
  if (Array.isArray(reports)) {
    return envelopeList(
      reports.map((r) => ({
        package: r.package,
        orphanedRefs: r.orphanedRefs,
        unusedSchemaKeys: r.unusedSchemaKeys,
        dynamicRefs: r.dynamicRefs,
        warnings: r.warnings,
        ...(r.error ? { error: r.error } : {}),
      })),
    );
  } else {
    return envelope({
      orphanedRefs: reports.orphanedRefs,
      unusedSchemaKeys: reports.unusedSchemaKeys,
      dynamicRefs: reports.dynamicRefs,
      warnings: reports.warnings,
      ...(reports.error ? { error: reports.error } : {}),
    });
  }
}
