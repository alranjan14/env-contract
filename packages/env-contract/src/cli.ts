#!/usr/bin/env node
import { cac } from "cac";
import pc from "picocolors";
import { version } from "./index.js";
import { resolveConfig } from "./config.js";
import { ExitCode } from "./utils/exit-code.js";
import { toError } from "./utils/errors.js";

// cac hands action callbacks an untyped options bag; this is the typed view of
// the global + per-command flags declared below. Annotating the callback param
// is the single narrowing point for all CLI input.
interface CliOptions {
  // global
  config?: string;
  schema?: string;
  cwd?: string;
  silent?: boolean;
  json?: boolean;
  debug?: boolean;
  // sync
  target?: string;
  yes?: boolean;
  check?: boolean;
  watch?: boolean;
  workspace?: boolean;
  // scan
  include?: string | string[];
  exclude?: string | string[];
  strict?: boolean;
  // install
  hook?: string;
}

const cli = cac("env-contract");

cli
  .option("--config <path>", "Path to config file")
  .option("--schema <path>", "Path to env schema file")
  .option("--cwd <path>", "Working directory")
  .option("--silent", "Suppress non-error output")
  .option("--json", "Machine-readable output")
  .option("--debug", "Print timings and resolved paths to stderr");

cli
  .command("sync", "Generate or update .env.example from the schema")
  .option("--target <path>", "Target example file to write")
  .option("--yes", "Non-interactive mode")
  .option("--check", "Exit non-zero if would change anything")
  .option("--watch", "Watch schema for changes")
  .option("--workspace", "Run across all workspace packages")
  .action(async (options: CliOptions) => {
    const cwd = options.cwd || process.cwd();
    const config = await resolveConfig(cwd, options.config);
    const { runSync } = await import("./commands/sync.js");
    const { code } = await runSync({ ...options, cwd }, config);
    if (code !== ExitCode.Ok) process.exit(code);
  });

cli
  .command("scan", "Walk source tree and report process.env references")
  .option("--include <pattern>", "Glob pattern to include")
  .option("--exclude <pattern>", "Glob pattern to exclude")
  .option("--strict", "Also flag schema entries unused in code")
  .option("--workspace", "Run across all workspace packages")
  .action(async (options: CliOptions) => {
    const cwd = options.cwd || process.cwd();
    const config = await resolveConfig(cwd, options.config);

    // cac parses multiple --include into an array if specified multiple times
    const include = options.include
      ? Array.isArray(options.include)
        ? options.include
        : [options.include]
      : undefined;
    const exclude = options.exclude
      ? Array.isArray(options.exclude)
        ? options.exclude
        : [options.exclude]
      : undefined;

    const { runScan } = await import("./commands/scan.js");
    const { code } = await runScan({ ...options, cwd, include, exclude }, config);
    if (code !== ExitCode.Ok) process.exit(code);
  });

cli
  .command("check", "CI-friendly composite command (sync --check + scan)")
  .option("--strict", "Also flag schema entries unused in code")
  .option("--workspace", "Run across all workspace packages")
  .action(async (options: CliOptions) => {
    const cwd = options.cwd || process.cwd();
    const config = await resolveConfig(cwd, options.config);
    const { runCheck } = await import("./commands/check.js");
    const { code } = await runCheck({ ...options, cwd }, config);
    if (code !== ExitCode.Ok) process.exit(code);
  });

cli
  .command("install", "Idempotent setup helper for git hooks and CI")
  .option("--hook <name>", "Git hook to install to (default: pre-commit)")
  .option("--yes", "Non-interactive mode")
  .action(async (options: CliOptions) => {
    const cwd = options.cwd || process.cwd();
    const config = await resolveConfig(cwd, options.config);
    const { runInstall } = await import("./commands/install.js");
    const { code } = await runInstall({ ...options, cwd }, config);
    if (code !== ExitCode.Ok) process.exit(code);
  });

cli.help();
cli.version(version);

async function main(): Promise<void> {
  // Parse without running so we can `await` the matched command and catch any
  // rejection (cac fires async actions but does not await them itself).
  cli.parse(process.argv, { run: false });
  await cli.runMatchedCommand();
}

main().catch((error: unknown) => {
  // Final safety net: a failure that escapes a command's own handling — e.g. a
  // malformed config that throws during resolution, before the command body
  // runs — becomes a clean one-line message on stderr and the RuntimeError exit
  // code, never a raw stack trace.
  process.stderr.write(pc.red(`✖ ${toError(error).message}\n`));
  process.exit(ExitCode.RuntimeError);
});
