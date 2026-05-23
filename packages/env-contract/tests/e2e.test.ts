import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const CLI_PATH = path.resolve(__dirname, "../dist/cli.js");
const TMP_DIR = path.resolve(__dirname, "../tmp-e2e");

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
    
    await fs.writeFile(envFile, `
import { z } from "zod";
export const schema = z.object({
  TEST_VAR: z.string().describe("Testing 123")
});
`);

    execSync(`node ${CLI_PATH} sync --yes`, {
      cwd: TMP_DIR,
      env: { ...process.env }
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
    await fs.writeFile(path.join(pkgADir, "src/env.ts"), `
      import { z } from "${zodPath}";
      export const schema = z.object({ WEB_VAR: z.string().describe("Web App") });
    `);
    
    // create pkg B
    const pkgBDir = path.join(wsDir, "packages/api");
    await fs.mkdir(path.join(pkgBDir, "src"), { recursive: true });
    await fs.writeFile(path.join(pkgBDir, "package.json"), '{"name":"api"}');
    await fs.writeFile(path.join(pkgBDir, "src/env.ts"), `
      import { z } from "${zodPath}";
      export const schema = z.object({ API_VAR: z.string().describe("API Package") });
    `);

    try {
      execSync(`node ${CLI_PATH} sync --workspace --yes`, {
        cwd: wsDir,
        env: { ...process.env },
        stdio: "pipe"
      });
    } catch (e: any) {
      console.log("E2E SYNC ERROR:", e.stdout?.toString(), e.stderr?.toString());
      throw e;
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
    await fs.writeFile(path.join(configDir, "env-contract.config.ts"), `
      export default {
        schema: "src/default.ts",
        exampleFile: ".env.default"
      };
    `);

    // Create schema file at the override path
    await fs.writeFile(path.join(configDir, "src/override.ts"), `
      import { z } from "zod";
      export const schema = z.object({ OVERRIDE_VAR: z.string().describe("Override Test") });
    `);

    // Run sync with CLI flags
    execSync(`node ${CLI_PATH} sync --yes --schema src/override.ts --target .env.override`, {
      cwd: configDir,
      env: { ...process.env },
      stdio: "pipe"
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
    await fs.writeFile(path.join(checkDir, "src/env.ts"), `
      import { z } from "zod";
      export const schema = z.object({ CHECK_VAR: z.string() });
    `);

    // Create source file using the var (no dynamic, no orphaned)
    await fs.writeFile(path.join(checkDir, "src/index.ts"), `
      console.log(process.env.CHECK_VAR);
    `);

    // Run check --json
    let stdout = "";
    try {
      stdout = execSync(`node ${CLI_PATH} check --json`, {
        cwd: checkDir,
        env: { ...process.env },
        stdio: "pipe"
      }).toString();
    } catch (e: any) {
      stdout = e.stdout.toString(); // Will exit 1 because of syncDrift (no .env.example)
    }

    const report = JSON.parse(stdout);
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
    await fs.writeFile(path.join(strictDir, "src/env.ts"), `
      import { z } from "zod";
      export const schema = z.object({ UNUSED_VAR: z.string() });
    `);

    // Run sync to ensure no sync drift
    execSync(`node ${CLI_PATH} sync --yes`, { cwd: strictDir });

    // Run check without strict (should pass)
    expect(() => execSync(`node ${CLI_PATH} check`, { cwd: strictDir })).not.toThrow();

    // Run check --strict (should fail)
    expect(() => execSync(`node ${CLI_PATH} check --strict`, { cwd: strictDir })).toThrow();
  });
});
