#!/usr/bin/env node
import { cac } from "cac";
import { version } from "./index.js";

const cli = cac("env-contract");

cli
  .command("sync", "Generate or update .env.example from the schema")
  .option("--yes", "Non-interactive mode")
  .option("--check", "Exit non-zero if would change anything")
  .option("--watch", "Watch schema for changes")
  .action(async (options) => {
    const { runSync } = await import("./commands/sync.js");
    const code = await runSync(options);
    if (code !== 0) process.exit(code);
  });

cli
  .command("scan", "Walk source tree and report process.env references")
  .option("--strict", "Also flag schema entries unused in code")
  .option("--json", "Machine-readable output")
  .action(async (options) => {
    const { runScan } = await import("./commands/scan.js");
    const code = await runScan(options);
    if (code !== 0) process.exit(code);
  });

cli
  .command("check", "CI-friendly composite command (sync --check + scan)")
  .option("--json", "Machine-readable output")
  .action(async (options) => {
    const { runCheck } = await import("./commands/check.js");
    const code = await runCheck(options);
    if (code !== 0) process.exit(code);
  });

cli
  .command("install", "Idempotent setup helper for git hooks and CI")
  .option("--hook <name>", "Git hook to install to (default: pre-commit)")
  .option("--yes", "Non-interactive mode")
  .action(async (options) => {
    const { runInstall } = await import("./commands/install.js");
    const code = await runInstall(options);
    if (code !== 0) process.exit(code);
  });

cli.help();
cli.version(version);

cli.parse();
