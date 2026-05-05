import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

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
});
