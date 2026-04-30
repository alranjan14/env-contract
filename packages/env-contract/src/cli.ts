#!/usr/bin/env node
import { cac } from "cac";
import pc from "picocolors";
import { version } from "./index.js";

const cli = cac("env-contract");

cli
  .command("sync", "Generate or update .env.example from the schema")
  .option("--yes", "Non-interactive mode")
  .option("--check", "Exit non-zero if would change anything")
  .action((options) => {
    console.log(pc.cyan("Syncing environment variables..."));
    // TODO: Implement sync logic
  });

cli
  .command("scan", "Walk source tree and report process.env references")
  .option("--strict", "Also flag schema entries unused in code")
  .action((options) => {
    console.log(pc.cyan("Scanning source for environment references..."));
    // TODO: Implement scan logic
  });

cli
  .command("check", "CI-friendly composite command (sync --check + scan)")
  .action(() => {
    console.log(pc.cyan("Running environment contract check..."));
    // TODO: Implement check logic
  });

cli.help();
cli.version(version);

cli.parse();
