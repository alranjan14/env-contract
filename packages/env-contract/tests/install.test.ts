import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInstall, detectPackageManager } from "../src/commands/install.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Install Hook Helper", () => {
  const tempDir = path.resolve(__dirname, "./temp-install-test");
  const originalUserAgent = process.env.npm_config_user_agent;

  beforeAll(async () => {
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Reset process.env.npm_config_user_agent
    if (originalUserAgent) {
      process.env.npm_config_user_agent = originalUserAgent;
    } else {
      delete process.env.npm_config_user_agent;
    }
  });

  describe("detectPackageManager", () => {
    it("should detect from process.env.npm_config_user_agent first", async () => {
      const caseDir = path.join(tempDir, "pm-agent-pnpm");
      await fs.mkdir(caseDir, { recursive: true });

      process.env.npm_config_user_agent = "pnpm/9.0.6 npm/? node/v20.19.5 darwin arm64";
      const cmd = await detectPackageManager(caseDir);
      expect(cmd).toBe("pnpm exec");

      process.env.npm_config_user_agent = "bun/1.1.8 npm/? node/v20.19.5 darwin arm64";
      const cmdBun = await detectPackageManager(caseDir);
      expect(cmdBun).toBe("bunx");
    });

    it("should detect from lockfile presence if agent is absent", async () => {
      const caseDir = path.join(tempDir, "pm-lock-yarn");
      await fs.mkdir(caseDir, { recursive: true });
      delete process.env.npm_config_user_agent;

      await fs.writeFile(path.join(caseDir, "yarn.lock"), "");
      const cmd = await detectPackageManager(caseDir);
      expect(cmd).toBe("yarn exec");
    });

    it("should fallback to npm exec if no configuration is matched", async () => {
      const caseDir = path.join(tempDir, "pm-fallback");
      await fs.mkdir(caseDir, { recursive: true });
      delete process.env.npm_config_user_agent;

      const cmd = await detectPackageManager(caseDir);
      expect(cmd).toBe("npm exec");
    });
  });

  describe("runInstall", () => {
    it("should configure Husky hooks automatically in non-interactive mode", async () => {
      const caseDir = path.join(tempDir, "setup-husky");
      await fs.mkdir(caseDir, { recursive: true });
      process.env.npm_config_user_agent = "pnpm/9.0.6";

      // Mock package.json with Husky
      const pkg = { devDependencies: { husky: "^9.0.0" } };
      await fs.writeFile(path.join(caseDir, "package.json"), JSON.stringify(pkg));

      const { code } = await runInstall({ yes: true, cwd: caseDir });
      expect(code).toBe(0);

      const hookFile = path.join(caseDir, ".husky/pre-commit");
      const content = await fs.readFile(hookFile, "utf-8");
      expect(content).toContain("pnpm exec env-contract check");

      // Verify executable permission
      const stats = await fs.stat(hookFile);
      // On Unix, check that owner execution bit is set
      if (process.platform !== "win32") {
        expect(stats.mode & 0o111).toBeGreaterThan(0);
      }
    });

    it("should update Husky hooks idempotently", async () => {
      const caseDir = path.join(tempDir, "idempotent-husky");
      await fs.mkdir(caseDir, { recursive: true });
      process.env.npm_config_user_agent = "pnpm/9.0.6";

      const pkg = { devDependencies: { husky: "^9.0.0" } };
      await fs.writeFile(path.join(caseDir, "package.json"), JSON.stringify(pkg));

      // Create existing hook with exact string
      await fs.mkdir(path.join(caseDir, ".husky"), { recursive: true });
      const hookPath = path.join(caseDir, ".husky/pre-commit");
      await fs.writeFile(hookPath, "#!/usr/bin/env sh\nnpx env-contract check\n");

      // Run install (idempotency check should trigger since 'env-contract check' is already present)
      await runInstall({ yes: true, cwd: caseDir });

      const content = await fs.readFile(hookPath, "utf-8");
      // Should not append another execution command
      const matches = content.match(/env-contract check/g);
      expect(matches).toHaveLength(1);
    });

    it("should configure Simple Git Hooks automatically in non-interactive mode", async () => {
      const caseDir = path.join(tempDir, "setup-simple");
      await fs.mkdir(caseDir, { recursive: true });
      process.env.npm_config_user_agent = "pnpm/9.0.6";

      const pkg = { devDependencies: { "simple-git-hooks": "^2.0.0" } };
      await fs.writeFile(path.join(caseDir, "package.json"), JSON.stringify(pkg, null, 2));

      const { code } = await runInstall({ yes: true, cwd: caseDir });
      expect(code).toBe(0);

      const pkgContent = await fs.readFile(path.join(caseDir, "package.json"), "utf-8");
      const updatedPkg = JSON.parse(pkgContent);
      expect(updatedPkg["simple-git-hooks"]).toEqual({
        "pre-commit": "pnpm exec env-contract check",
      });
    });

    it("should update Simple Git Hooks idempotently", async () => {
      const caseDir = path.join(tempDir, "idempotent-simple");
      await fs.mkdir(caseDir, { recursive: true });
      process.env.npm_config_user_agent = "pnpm/9.0.6";

      const pkg = {
        devDependencies: { "simple-git-hooks": "^2.0.0" },
        "simple-git-hooks": { "pre-commit": "npx env-contract check" },
      };
      await fs.writeFile(path.join(caseDir, "package.json"), JSON.stringify(pkg, null, 2));

      await runInstall({ yes: true, cwd: caseDir });

      const pkgContent = await fs.readFile(path.join(caseDir, "package.json"), "utf-8");
      const updatedPkg = JSON.parse(pkgContent);
      expect(updatedPkg["simple-git-hooks"]["pre-commit"]).toBe("npx env-contract check");
    });

    it("should configure Lefthook automatically in non-interactive mode", async () => {
      const caseDir = path.join(tempDir, "setup-lefthook");
      await fs.mkdir(caseDir, { recursive: true });
      process.env.npm_config_user_agent = "pnpm/9.0.6";

      // Mock package.json with Lefthook
      const pkg = { devDependencies: { lefthook: "^1.0.0" } };
      await fs.writeFile(path.join(caseDir, "package.json"), JSON.stringify(pkg));

      const { code } = await runInstall({ yes: true, cwd: caseDir });
      expect(code).toBe(0);

      const lfFile = path.join(caseDir, "lefthook.yml");
      const content = await fs.readFile(lfFile, "utf-8");
      expect(content).toContain("pre-commit:");
      expect(content).toContain("run: pnpm exec env-contract check");
    });

    it("should update Lefthook configurations idempotently", async () => {
      const caseDir = path.join(tempDir, "idempotent-lefthook");
      await fs.mkdir(caseDir, { recursive: true });
      process.env.npm_config_user_agent = "pnpm/9.0.6";

      // Mock lefthook.yml with existing env-contract
      const existingYaml = `
pre-commit:
  commands:
    env-contract:
      run: npx env-contract check
      `;
      await fs.writeFile(path.join(caseDir, "lefthook.yml"), existingYaml);

      const pkg = { devDependencies: { lefthook: "^1.0.0" } };
      await fs.writeFile(path.join(caseDir, "package.json"), JSON.stringify(pkg));

      await runInstall({ yes: true, cwd: caseDir });

      const content = await fs.readFile(path.join(caseDir, "lefthook.yml"), "utf-8");
      const matches = content.match(/env-contract/g);
      expect(matches).toHaveLength(2); // commands: env-contract, run: npx env-contract check
    });
  });
});
