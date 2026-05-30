import pc from "picocolors";
import type { SyncReport, ScanReportData, CheckReport } from "./types.js";

export function reportSync(r: SyncReport | SyncReport[], options: { check?: boolean | undefined }): void {
  const reports = Array.isArray(r) ? r : [r];

  for (const rep of reports) {
    if (rep.package && reports.length > 1) {
      console.log(pc.magenta(`\n📦 ${rep.package}`));
    }

    const exampleFile = rep.exampleFile;

    if (rep.error) {
      console.error(pc.red(`✖ Sync failed${rep.package ? ` for ${rep.package}` : ""}: ${rep.error}`));
      continue;
    }

    if (!rep.syncDrift) {
      console.log(pc.green(`✔ ${exampleFile} is already up to date with the schema.`));
      continue;
    }

    if (options.check) {
      console.error(pc.red(`\n✖ Drift detected in ${exampleFile}.`));
      if (rep.missingInExample.length > 0) {
        console.error(pc.yellow(`  Missing keys in managed block:`));
        for (const key of rep.missingInExample) {
          console.error(`    - ${pc.red(key)}`);
        }
      }
      if (rep.extraInExample.length > 0) {
        console.error(pc.yellow(`  Extra keys in managed block (not in schema):`));
        for (const key of rep.extraInExample) {
          console.error(`    - ${pc.red(key)}`);
        }
      }
      console.error(pc.yellow(`👉 Suggestion: Run \`env-contract sync\` to update.`));
    } else {
      console.log(pc.green(`✔ Successfully updated ${exampleFile}.`));
    }
  }
}

export function reportScan(r: ScanReportData | ScanReportData[], options: { strict?: boolean | undefined }): void {
  const reports = Array.isArray(r) ? r : [r];
  let printedErrors = false;

  for (const rep of reports) {
    if (rep.error) {
      console.error(pc.red(`✖ Scan failed${rep.package ? ` for ${rep.package}` : ""}: ${rep.error}`));
      printedErrors = true;
      continue;
    }

    const orphanedRefs = rep.orphanedRefs;
    const dynamicRefs = rep.dynamicRefs;
    const unusedSchemaKeys = rep.unusedSchemaKeys;
    const warnings = rep.warnings;

    if (orphanedRefs.length > 0 || dynamicRefs.length > 0 || (options.strict && unusedSchemaKeys.length > 0) || warnings.length > 0) {
      if (rep.package) {
        console.log(pc.magenta(`\n📦 ${rep.package}`));
      }
      printedErrors = true;
      
      if (warnings.length > 0) {
        console.log(pc.yellow(`Found ${warnings.length} file parse warnings:`));
        for (const w of warnings) {
          console.log(`  ${pc.gray(w.file)}: ${pc.red(w.message)}`);
        }
      }
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
    if (Array.isArray(r)) {
      console.log(pc.green("✔ No environment contract violations found in any workspace package."));
    } else {
      console.log(pc.green("✔ No environment contract violations found in code."));
    }
  }
}

export function reportCheck(report: CheckReport, _options: { strict?: boolean | undefined }): void {
  if (report.ok) {
    console.log(pc.green("\n✔ Environment contract is healthy."));
    return;
  }

  let hasSyncDrift = false;
  let totalOrphaned = 0;

  for (const pkg of report.packages) {
    if (pkg.error) {
      console.error(pc.red(`✖ Check failed for ${pkg.package}: ${pkg.error}`));
      continue;
    }
    if (pkg.syncDrift) {
      hasSyncDrift = true;
    }
    totalOrphaned += pkg.orphanedRefs.length;
  }

  if (hasSyncDrift) {
    console.error(pc.red("\n✗ .env.example is out of date"));
    console.error(pc.red("  Run `env-contract sync` to update."));
  }

  if (totalOrphaned > 0) {
    console.error(pc.red(`\n✗ Found ${totalOrphaned} reference(s) to variables not in the schema:`));
    for (const pkg of report.packages) {
      for (const ref of pkg.orphanedRefs) {
        const prefix = ref.kind === "import.meta.env" ? "import.meta.env" : "process.env";
        console.error(`  ${pc.gray(`${ref.file}:${ref.line}:${ref.column}`)}  ${pc.red(`${prefix}.${ref.key}`)}`);
      }
    }
  }

  console.error(pc.red("\n✖ Environment contract check failed."));
  console.error(pc.yellow("👉 Suggestion: Fix this by running 'npx env-contract sync' locally and committing the result."));
}
