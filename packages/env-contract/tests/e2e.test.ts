import { describe, it, expect, beforeAll } from "vitest";
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const CLI_PATH = path.resolve(__dirname, "../dist/cli.js");
const TMP_DIR = path.resolve(__dirname, "../tmp-e2e");

interface ExecError {
  status: number | null;
  stdout: Buffer;
  stderr: Buffer;
}
// execSync throws an Error augmented with the child's stdout/stderr/status.
const execErr = (e: unknown): ExecError => e as ExecError;

describe("CLI E2E", () => {
  beforeAll(async () => {
    await fs.mkdir(TMP_DIR, { recursive: true });
    // Cleanup on exit
    return async () => {
      await fs.rm(TMP_DIR, { recursive: true, force: true });
    };
  });

  it("should show help", async () => {
    const stdout = execSync(`node ${CLI_PATH} --help`).toString();
    expect(stdout).toContain("env-contract <command> [options]");
  });

  it("should sync schema to .env.example", async () => {
    const srcDir = path.join(TMP_DIR, "src");
    await fs.mkdir(srcDir, { recursive: true });
    const envFile = path.join(srcDir, "env.ts");
    const exampleFile = path.join(TMP_DIR, ".env.example");

    await fs.writeFile(
      envFile,
      `
import { z } from "zod";
export const schema = z.object({
  TEST_VAR: z.string().describe("Testing 123")
});
`,
    );

    execSync(`node ${CLI_PATH} sync --yes`, {
      cwd: TMP_DIR,
      env: { ...process.env },
    });

    const content = await fs.readFile(exampleFile, "utf-8");
    expect(content).toContain("TEST_VAR=");
    expect(content).toContain("Testing 123");
  });

  it("should sync workspace packages", async () => {
    // create workspace root with package.json
    const wsDir = path.join(TMP_DIR, "workspace");
    await fs.mkdir(wsDir, { recursive: true });

    const zodPath = require.resolve("zod").replace(/\\/g, "/");

    // create pkg A
    const pkgADir = path.join(wsDir, "apps/web");
    await fs.mkdir(path.join(pkgADir, "src"), { recursive: true });
    await fs.writeFile(path.join(pkgADir, "package.json"), '{"name":"web"}');
    await fs.writeFile(
      path.join(pkgADir, "src/env.ts"),
      `
      import { z } from "${zodPath}";
      export const schema = z.object({ WEB_VAR: z.string().describe("Web App") });
    `,
    );

    // create pkg B
    const pkgBDir = path.join(wsDir, "packages/api");
    await fs.mkdir(path.join(pkgBDir, "src"), { recursive: true });
    await fs.writeFile(path.join(pkgBDir, "package.json"), '{"name":"api"}');
    await fs.writeFile(
      path.join(pkgBDir, "src/env.ts"),
      `
      import { z } from "${zodPath}";
      export const schema = z.object({ API_VAR: z.string().describe("API Package") });
    `,
    );

    try {
      execSync(`node ${CLI_PATH} sync --workspace --yes`, {
        cwd: wsDir,
        env: { ...process.env },
        stdio: "pipe",
      });
    } catch (eRaw: unknown) {
      const e = execErr(eRaw);
      console.log("E2E SYNC ERROR:", e.stdout?.toString(), e.stderr?.toString());
      throw eRaw;
    }

    const webExample = await fs.readFile(path.join(pkgADir, ".env.example"), "utf-8");
    const apiExample = await fs.readFile(path.join(pkgBDir, ".env.example"), "utf-8");

    expect(webExample).toContain("WEB_VAR=");
    expect(webExample).toContain("Web App");

    expect(apiExample).toContain("API_VAR=");
    expect(apiExample).toContain("API Package");
  });

  it("should override config values with CLI flags", async () => {
    const configDir = path.join(TMP_DIR, "config-override");
    await fs.mkdir(path.join(configDir, "src"), { recursive: true });

    // Create config file
    await fs.writeFile(
      path.join(configDir, "env-contract.config.ts"),
      `
      export default {
        schema: "src/default.ts",
        exampleFile: ".env.default"
      };
    `,
    );

    // Create schema file at the override path
    await fs.writeFile(
      path.join(configDir, "src/override.ts"),
      `
      import { z } from "zod";
      export const schema = z.object({ OVERRIDE_VAR: z.string().describe("Override Test") });
    `,
    );

    // Run sync with CLI flags
    execSync(`node ${CLI_PATH} sync --yes --schema src/override.ts --target .env.override`, {
      cwd: configDir,
      env: { ...process.env },
      stdio: "pipe",
    });

    const overrideExample = await fs.readFile(path.join(configDir, ".env.override"), "utf-8");
    expect(overrideExample).toContain("OVERRIDE_VAR=");
    expect(overrideExample).toContain("Override Test");

    // Ensure the default example file was NOT created
    await expect(fs.access(path.join(configDir, ".env.default"))).rejects.toThrow();
  });

  it("should output JSON for check command", async () => {
    const checkDir = path.join(TMP_DIR, "check-json");
    await fs.mkdir(path.join(checkDir, "src"), { recursive: true });

    // Create schema file
    await fs.writeFile(
      path.join(checkDir, "src/env.ts"),
      `
      import { z } from "zod";
      export const schema = z.object({ CHECK_VAR: z.string() });
    `,
    );

    // Create source file using the var (no dynamic, no orphaned)
    await fs.writeFile(
      path.join(checkDir, "src/index.ts"),
      `
      console.log(process.env.CHECK_VAR);
    `,
    );

    // Run check --json
    let stdout = "";
    try {
      stdout = execSync(`node ${CLI_PATH} check --json`, {
        cwd: checkDir,
        env: { ...process.env },
        stdio: "pipe",
      }).toString();
    } catch (eRaw: unknown) {
      const e = execErr(eRaw);
      stdout = e.stdout.toString(); // Will exit 1 because of syncDrift (no .env.example)
    }

    const report = JSON.parse(stdout);
    expect(report.schemaVersion).toBe(1); // versioned envelope for downstream parsers
    expect(report).toHaveProperty("syncDrift", true); // No example file exists
    expect(report).toHaveProperty("orphanedRefs");
    expect(report.orphanedRefs).toHaveLength(0);
    expect(report).toHaveProperty("unusedSchemaKeys");
    expect(report.unusedSchemaKeys).toHaveLength(0);
    expect(report).toHaveProperty("dynamicRefs");
    expect(report.dynamicRefs).toHaveLength(0);
  });

  it("should not fail on unused schema keys by default", async () => {
    const strictDir = path.join(TMP_DIR, "check-strict");
    await fs.mkdir(path.join(strictDir, "src"), { recursive: true });

    // Schema with unused variable
    await fs.writeFile(
      path.join(strictDir, "src/env.ts"),
      `
      import { z } from "zod";
      export const schema = z.object({ UNUSED_VAR: z.string() });
    `,
    );

    // Run sync to ensure no sync drift
    execSync(`node ${CLI_PATH} sync --yes`, { cwd: strictDir });

    // Run check without strict (should pass)
    expect(() => execSync(`node ${CLI_PATH} check`, { cwd: strictDir })).not.toThrow();

    // Run check --strict (should fail)
    expect(() => execSync(`node ${CLI_PATH} check --strict`, { cwd: strictDir })).toThrow();
  });

  it("should sync and preserve manual content outside the managed block", async () => {
    const testDir = path.join(TMP_DIR, "sync-preserve-manual");
    await fs.mkdir(path.join(testDir, "src"), { recursive: true });

    await fs.writeFile(
      path.join(testDir, "src/env.ts"),
      `
      import { z } from "zod";
      export const envSchema = z.object({ SYNC_VAR: z.string() });
    `,
    );

    const exampleFile = path.join(testDir, ".env.example");
    await fs.writeFile(
      exampleFile,
      `
# Manual configuration header
CUSTOM_MANUAL_VAR=123

# >>> env-contract:start (do not edit this block manually)
# <<< env-contract:end

# Footer manual setting
ANOTHER_MANUAL_VAR=456
    `,
    );

    execSync(`node ${CLI_PATH} sync --yes`, { cwd: testDir });

    const content = await fs.readFile(exampleFile, "utf-8");
    expect(content).toContain("CUSTOM_MANUAL_VAR=123");
    expect(content).toContain("ANOTHER_MANUAL_VAR=456");
    expect(content).toContain("SYNC_VAR=");
    expect(content).toContain("env-contract:start");
    expect(content).toContain("env-contract:end");
  });

  it("should exit 1 on sync --check when drift exists and should not write files", async () => {
    const testDir = path.join(TMP_DIR, "sync-check-drift");
    await fs.mkdir(path.join(testDir, "src"), { recursive: true });

    await fs.writeFile(
      path.join(testDir, "src/env.ts"),
      `
      import { z } from "zod";
      export const envSchema = z.object({ DRIFT_VAR: z.string() });
    `,
    );

    const exampleFile = path.join(testDir, ".env.example");
    await fs.writeFile(
      exampleFile,
      `
# >>> env-contract:start (do not edit this block manually)
# <<< env-contract:end
    `,
    );

    // sync --check should throw due to non-zero exit code (drift)
    let threw = false;
    try {
      execSync(`node ${CLI_PATH} sync --check`, { cwd: testDir, stdio: "pipe" });
    } catch (eRaw: unknown) {
      const e = execErr(eRaw);
      threw = true;
      expect(e.status).toBe(1);
    }
    expect(threw).toBe(true);

    // The file should NOT have been updated (managed block remains empty)
    const content = await fs.readFile(exampleFile, "utf-8");
    expect(content).not.toContain("DRIFT_VAR=");
  });

  it("should report orphaned references and exit 1 on scan", async () => {
    const testDir = path.join(TMP_DIR, "scan-orphaned");
    await fs.mkdir(path.join(testDir, "src"), { recursive: true });

    await fs.writeFile(
      path.join(testDir, "src/env.ts"),
      `
      import { z } from "zod";
      export const envSchema = z.object({ TRACKED_VAR: z.string() });
    `,
    );

    await fs.writeFile(
      path.join(testDir, "src/index.ts"),
      `
      console.log(process.env.TRACKED_VAR);
      console.log(process.env.SOME_ORPHANED_VAR);
    `,
    );

    let threw = false;
    let stdout = "";
    try {
      stdout = execSync(`node ${CLI_PATH} scan`, { cwd: testDir, stdio: "pipe" }).toString();
    } catch (eRaw: unknown) {
      const e = execErr(eRaw);
      threw = true;
      stdout = e.stdout.toString() + e.stderr.toString();
      expect(e.status).toBe(1);
    }
    expect(threw).toBe(true);
    expect(stdout).toContain("SOME_ORPHANED_VAR");
  });

  it("should pass on scan without strict, but fail and exit 1 on scan --strict when unused keys exist", async () => {
    const testDir = path.join(TMP_DIR, "scan-strict");
    await fs.mkdir(path.join(testDir, "src"), { recursive: true });

    await fs.writeFile(
      path.join(testDir, "src/env.ts"),
      `
      import { z } from "zod";
      export const envSchema = z.object({ 
        USED_VAR: z.string(),
        UNUSED_VAR: z.string() 
      });
    `,
    );

    await fs.writeFile(
      path.join(testDir, "src/index.ts"),
      `
      console.log(process.env.USED_VAR);
    `,
    );

    // scan should pass (exit 0)
    const scanOutput = execSync(`node ${CLI_PATH} scan`, { cwd: testDir }).toString();
    expect(scanOutput).toContain("No environment contract violations found");

    // scan --strict should fail (exit 1)
    let threw = false;
    let strictOutput = "";
    try {
      strictOutput = execSync(`node ${CLI_PATH} scan --strict`, {
        cwd: testDir,
        stdio: "pipe",
      }).toString();
    } catch (eRaw: unknown) {
      const e = execErr(eRaw);
      threw = true;
      strictOutput = e.stdout.toString() + e.stderr.toString();
      expect(e.status).toBe(1);
    }
    expect(threw).toBe(true);
    expect(strictOutput).toContain("UNUSED_VAR");
  });

  it("should report sync drift and scan drift together and exit 1 on check", async () => {
    const testDir = path.join(TMP_DIR, "check-composite");
    await fs.mkdir(path.join(testDir, "src"), { recursive: true });

    await fs.writeFile(
      path.join(testDir, "src/env.ts"),
      `
      import { z } from "zod";
      export const envSchema = z.object({ 
        SYNC_DRIFT_VAR: z.string(),
        SCAN_DRIFT_VAR: z.string() 
      });
    `,
    );

    // index has scan drift (orphaned variable)
    await fs.writeFile(
      path.join(testDir, "src/index.ts"),
      `
      console.log(process.env.SYNC_DRIFT_VAR);
      console.log(process.env.SOME_ORPHANED_VAR);
    `,
    );

    // example has sync drift (lacks SYNC_DRIFT_VAR)
    const exampleFile = path.join(testDir, ".env.example");
    await fs.writeFile(
      exampleFile,
      `
# >>> env-contract:start (do not edit this block manually)
# <<< env-contract:end
    `,
    );

    let threw = false;
    let stdout = "";
    try {
      stdout = execSync(`node ${CLI_PATH} check`, { cwd: testDir, stdio: "pipe" }).toString();
    } catch (eRaw: unknown) {
      const e = execErr(eRaw);
      threw = true;
      stdout = e.stdout.toString() + e.stderr.toString();
      expect(e.status).toBe(1);
    }
    expect(threw).toBe(true);
    expect(stdout).toContain(".env.example is out of date");
    expect(stdout).toContain("SOME_ORPHANED_VAR");
  });

  it("should output valid JSON for success, drift, and runtime error cases", async () => {
    const testDir = path.join(TMP_DIR, "json-validity");
    await fs.mkdir(path.join(testDir, "src"), { recursive: true });

    await fs.writeFile(
      path.join(testDir, "src/env.ts"),
      `
      import { z } from "zod";
      export const envSchema = z.object({ JSON_VAR: z.string() });
    `,
    );

    await fs.writeFile(
      path.join(testDir, "src/index.ts"),
      `
      console.log(process.env.JSON_VAR);
    `,
    );

    // 1. Drift Case (no .env.example yet)
    let driftStdout = "";
    try {
      driftStdout = execSync(`node ${CLI_PATH} check --json`, {
        cwd: testDir,
        stdio: "pipe",
      }).toString();
    } catch (eRaw: unknown) {
      const e = execErr(eRaw);
      driftStdout = e.stdout.toString();
      expect(e.status).toBe(1);
    }
    const driftReport = JSON.parse(driftStdout);
    expect(driftReport.syncDrift).toBe(true);

    // 2. Success Case (after syncing)
    execSync(`node ${CLI_PATH} sync --yes`, { cwd: testDir });
    const successStdout = execSync(`node ${CLI_PATH} check --json`, { cwd: testDir }).toString();
    const successReport = JSON.parse(successStdout);
    expect(successReport.syncDrift).toBe(false);
    expect(successReport.orphanedRefs).toHaveLength(0);

    // 3. Runtime Error Case (invalid schema path)
    let errorStdout = "";
    try {
      errorStdout = execSync(`node ${CLI_PATH} check --json --schema src/does-not-exist.ts`, {
        cwd: testDir,
        stdio: "pipe",
      }).toString();
    } catch (eRaw: unknown) {
      const e = execErr(eRaw);
      errorStdout = e.stdout.toString();
      expect(e.status).toBe(2);
    }
    const errorReport = JSON.parse(errorStdout);
    expect(errorReport.error).toBeDefined();
    expect(errorReport.error).toContain("Schema file not found");
  });

  it("exits 2 with a clean message (not a raw stack) when the config is malformed", async () => {
    const badDir = path.join(TMP_DIR, "bad-config");
    await fs.mkdir(path.join(badDir, "src"), { recursive: true });
    await fs.writeFile(
      path.join(badDir, "src/env.ts"),
      `import { z } from "zod";\nexport const schema = z.object({ A: z.string() });\n`,
    );
    // Loads fine but is the wrong shape: assertConfig must reject it, and the
    // top-level safety net must turn that throw into a clean exit 2 — this path
    // (config resolution) runs before a command's own try/catch.
    await fs.writeFile(path.join(badDir, "env-contract.config.ts"), `export default 123;\n`);

    let status: number | null = 0;
    let stderr = "";
    try {
      execSync(`node ${CLI_PATH} check`, { cwd: badDir, stdio: "pipe" });
    } catch (eRaw: unknown) {
      const e = execErr(eRaw);
      status = e.status;
      stderr = e.stderr.toString();
    }

    expect(status).toBe(2);
    expect(stderr).toContain("must export an object");
    // Clean message, not a raw multi-line V8 stack trace (no "  at …" frames).
    // Tolerates unrelated Node deprecation/experimental warnings on stderr, which
    // surface in some CI environments (e.g. the punycode DEP) but aren't a stack.
    expect(stderr).not.toMatch(/^\s+at\s/m);
  });

  it("keeps --json stdout clean while --debug writes diagnostics only to stderr", async () => {
    const dir = path.join(TMP_DIR, "json-debug");
    await fs.mkdir(path.join(dir, "src"), { recursive: true });
    await fs.writeFile(
      path.join(dir, "src/env.ts"),
      `import { z } from "zod";\nexport const schema = z.object({ JSON_DEBUG_VAR: z.string() });\n`,
    );
    await fs.writeFile(
      path.join(dir, "src/index.ts"),
      `console.log(process.env.JSON_DEBUG_VAR);\n`,
    );
    // Sync first so `check` is clean (exit 0) and stdout is a single JSON object.
    execSync(`node ${CLI_PATH} sync --yes`, { cwd: dir });

    const result = spawnSync("node", [CLI_PATH, "check", "--json", "--debug"], {
      cwd: dir,
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);

    // stdout must be pure, parseable JSON — no debug noise leaked in. JSON.parse
    // would throw if a diagnostic line had been written to stdout.
    const report = JSON.parse(result.stdout);
    expect(report.schemaVersion).toBe(1);
    expect(result.stdout).not.toMatch(/\+\d+ms/);
    expect(result.stdout.toLowerCase()).not.toContain("check:");

    // The diagnostics went to stderr instead.
    expect(result.stderr).toContain("env-contract");
    expect(result.stderr).toMatch(/\+\d+ms/);
  });
});
