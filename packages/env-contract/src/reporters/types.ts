import type { Reference, DynamicReference } from "../core/scan-source.js";

export interface SyncReport {
  package?: string | undefined; // package directory path (if workspace)
  exampleFile: string;
  syncDrift: boolean;
  missingInExample: string[];
  extraInExample: string[];
  ignoredKeys: string[];
  error?: string | undefined;
}

export interface ScanReportData {
  package?: string | undefined; // package directory path (if workspace)
  rootDir: string;
  orphanedRefs: Reference[];
  unusedSchemaKeys: string[];
  dynamicRefs: DynamicReference[];
  warnings: Array<{ file: string; message: string }>;
  error?: string | undefined;
}

export interface PackageCheckReport {
  package: string;
  syncDrift: boolean;
  exampleDrift: {
    missingInExample: string[];
    extraInExample: string[];
  };
  orphanedRefs: Reference[];
  unusedSchemaKeys: string[];
  dynamicRefs: DynamicReference[];
  warnings: Array<{ file: string; message: string }>;
  error?: string | undefined;
}

export interface CheckReport {
  ok: boolean;
  workspace: boolean;
  packages: PackageCheckReport[];
}
