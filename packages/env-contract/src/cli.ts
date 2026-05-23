#!/usr/bin/env node
import { cac } from "cac";
import { version } from "./index.js";
import { resolveConfig } from "./config.js";

const cli = cac("env-contract");

cli.option("--config <path>", "Path to config file")
   .option("--schema <path>", "Path to env schema file")
   .option("--cwd <path>", "Working directory")
   .option("--silent", "Suppress non-error output")
   .option("--json", "Machine-readable output");

cli
  .command("sync", "Generate or update .env.example from the schema")
  .option("--target <path>", "Target example file to write")
  .option("--yes", "Non-interactive mode")
  .option("--check", "Exit non-zero if would change anything")
  .option("--watch", "Watch schema for changes")
  .option("--workspace", "Run across all workspace packages")
  .action(async (options) => {
    const cwd = options.cwd || process.cwd();
    const config = await resolveConfig(cwd, options.config);
    const { runSync } = await import("./commands/sync.js");
    const { code } = await runSync({ ...options, cwd }, config);
    if (code !== 0) process.exit(code);
  });

cli
  .command("scan", "Walk source tree and report process.env references")
  .option("--include <pattern>", "Glob pattern to include")
  .option("--exclude <pattern>", "Glob pattern to exclude")
  .option("--strict", "Also flag schema entries unused in code")
  .option("--workspace", "Run across all workspace packages")
  .action(async (options) => {
    const cwd = options.cwd || process.cwd();
    const config = await resolveConfig(cwd, options.config);
    
    // cac parses multiple --include into an array if specified multiple times
    const include = options.include ? (Array.isArray(options.include) ? options.include : [options.include]) : undefined;
    const exclude = options.exclude ? (Array.isArray(options.exclude) ? options.exclude : [options.exclude]) : undefined;
    
    const { runScan } = await import("./commands/scan.js");
    const { code } = await runScan({ ...options, cwd, include, exclude }, config);
    if (code !== 0) process.exit(code);
  });

cli
  .command("check", "CI-friendly composite command (sync --check + scan)")
  .option("--strict", "Also flag schema entries unused in code")
  .option("--workspace", "Run across all workspace packages")
  .action(async (options) => {
    const cwd = options.cwd || process.cwd();
    const config = await resolveConfig(cwd, options.config);
    const { runCheck } = await import("./commands/check.js");
    const { code } = await runCheck({ ...options, cwd }, config);
    if (code !== 0) process.exit(code);
  });

cli
  .command("install", "Idempotent setup helper for git hooks and CI")
  .option("--hook <name>", "Git hook to install to (default: pre-commit)")
  .option("--yes", "Non-interactive mode")
  .action(async (options) => {
    const cwd = options.cwd || process.cwd();
    const config = await resolveConfig(cwd, options.config);
    const { runInstall } = await import("./commands/install.js");
    const { code } = await runInstall({ ...options, cwd }, config);
    if (code !== 0) process.exit(code);
  });

cli.help();
cli.version(version);

cli.parse();
