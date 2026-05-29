import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parsePnpmWorkspaceYaml,
  resolveWorkspaceGlobs,
  checkIfPackageIsContractEnabled,
  findWorkspacePackages,
} from "../src/utils/workspace.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Workspace & Monorepo Discovery", () => {
  const tempDir = path.resolve(__dirname, "./temp-workspace-test");

  beforeAll(async () => {
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("parsePnpmWorkspaceYaml", () => {
    it("should parse standard multiline YAML packages lists", () => {
      const yaml = `
# This is a comment
packages:
  - 'apps/*'
  - "packages/*"
  - libs/common
      `;
      const result = parsePnpmWorkspaceYaml(yaml);
      expect(result).toEqual(["apps/*", "packages/*", "libs/common"]);
    });

    it("should parse inline array lists in packages block", () => {
      const yaml = `
packages: [ 'apps/*', "packages/*", libs/common ]
      `;
      const result = parsePnpmWorkspaceYaml(yaml);
      expect(result).toEqual(["apps/*", "packages/*", "libs/common"]);
    });

    it("should skip unrelated top-level blocks in YAML", () => {
      const yaml = `
packages:
  - apps/*
ignored_field:
  - should-not-be-parsed
      `;
      const result = parsePnpmWorkspaceYaml(yaml);
      expect(result).toEqual(["apps/*"]);
    });
  });

  describe("resolveWorkspaceGlobs", () => {
    it("should resolve wildcard asterisks, recursive wildcards, and concrete paths", async () => {
      const caseDir = path.join(tempDir, "globs-resolving");
      await fs.mkdir(caseDir, { recursive: true });

      // Create a mock folder structure
      // apps/web (enabled)
      await fs.mkdir(path.join(caseDir, "apps/web"), { recursive: true });
      await fs.writeFile(path.join(caseDir, "apps/web/package.json"), "{}");
      // apps/api (enabled)
      await fs.mkdir(path.join(caseDir, "apps/api"), { recursive: true });
      await fs.writeFile(path.join(caseDir, "apps/api/package.json"), "{}");
      // apps/docs (no package.json, should be ignored)
      await fs.mkdir(path.join(caseDir, "apps/docs"), { recursive: true });
      // libs/shared (enabled)
      await fs.mkdir(path.join(caseDir, "libs/shared"), { recursive: true });
      await fs.writeFile(path.join(caseDir, "libs/shared/package.json"), "{}");

      const globs = ["apps/*", "libs/shared"];
      const resolved = await resolveWorkspaceGlobs(caseDir, globs);

      // Normalise paths to use forward slashes for cross-platform comparison
      const normalized = resolved.map((p) => p.replace(/\\/g, "/"));

      expect(normalized).toHaveLength(3);
      expect(normalized).toContain(path.join(caseDir, "apps/web").replace(/\\/g, "/"));
      expect(normalized).toContain(path.join(caseDir, "apps/api").replace(/\\/g, "/"));
      expect(normalized).toContain(path.join(caseDir, "libs/shared").replace(/\\/g, "/"));
    });
  });

  describe("checkIfPackageIsContractEnabled", () => {
    it("should recognize config files as contract enabled", async () => {
      const pkgDir = path.join(tempDir, "pkg-config");
      await fs.mkdir(pkgDir, { recursive: true });
      await fs.writeFile(path.join(pkgDir, "package.json"), "{}");
      await fs.writeFile(path.join(pkgDir, "env-contract.config.ts"), "export default {}");

      const res = await checkIfPackageIsContractEnabled(pkgDir);
      expect(res).toEqual({ dir: pkgDir, type: "config" });
    });

    it("should recognize schema candidate files as contract enabled", async () => {
      const pkgDir = path.join(tempDir, "pkg-schema");
      await fs.mkdir(pkgDir, { recursive: true });
      await fs.writeFile(path.join(pkgDir, "package.json"), "{}");
      await fs.mkdir(path.join(pkgDir, "src"), { recursive: true });
      await fs.writeFile(path.join(pkgDir, "src/env.ts"), "export const env = {}");

      const res = await checkIfPackageIsContractEnabled(pkgDir);
      expect(res).toEqual({ dir: pkgDir, type: "env.ts" });
    });

    it("should return null if package has no env-contract definitions", async () => {
      const pkgDir = path.join(tempDir, "pkg-plain");
      await fs.mkdir(pkgDir, { recursive: true });
      await fs.writeFile(path.join(pkgDir, "package.json"), "{}");

      const res = await checkIfPackageIsContractEnabled(pkgDir);
      expect(res).toBeNull();
    });
  });

  describe("findWorkspacePackages integration", () => {
    it("should resolve workspace packages in order using pnpm-workspace.yaml", async () => {
      const monorepoRoot = path.join(tempDir, "monorepo");
      await fs.mkdir(monorepoRoot, { recursive: true });

      // Create pnpm-workspace.yaml
      await fs.writeFile(
        path.join(monorepoRoot, "pnpm-workspace.yaml"),
        "packages:\n  - 'apps/*'\n  - 'packages/*'"
      );

      // apps/web (enabled)
      const webDir = path.join(monorepoRoot, "apps/web");
      await fs.mkdir(webDir, { recursive: true });
      await fs.writeFile(path.join(webDir, "package.json"), "{}");
      await fs.mkdir(path.join(webDir, "src"), { recursive: true });
      await fs.writeFile(path.join(webDir, "src/env.ts"), "export const env = {}");

      // apps/api (plain, should be filtered out)
      const apiDir = path.join(monorepoRoot, "apps/api");
      await fs.mkdir(apiDir, { recursive: true });
      await fs.writeFile(path.join(apiDir, "package.json"), "{}");

      // packages/ui (enabled via package config)
      const uiDir = path.join(monorepoRoot, "packages/ui");
      await fs.mkdir(uiDir, { recursive: true });
      await fs.writeFile(path.join(uiDir, "package.json"), '{"env-contract": {}}');

      const pkgs = await findWorkspacePackages(monorepoRoot);
      expect(pkgs).toHaveLength(2);

      const webPkg = pkgs.find((p) => p.dir === webDir);
      const uiPkg = pkgs.find((p) => p.dir === uiDir);

      expect(webPkg).toBeDefined();
      expect(webPkg?.type).toBe("env.ts");

      expect(uiPkg).toBeDefined();
      expect(uiPkg?.type).toBe("config");
    });

    it("should resolve workspace packages in order using package.json workspaces", async () => {
      const monorepoRoot = path.join(tempDir, "npm-monorepo");
      await fs.mkdir(monorepoRoot, { recursive: true });

      // Create package.json with workspaces
      await fs.writeFile(
        path.join(monorepoRoot, "package.json"),
        JSON.stringify({ workspaces: ["packages/*"] })
      );

      // packages/core (enabled)
      const coreDir = path.join(monorepoRoot, "packages/core");
      await fs.mkdir(coreDir, { recursive: true });
      await fs.writeFile(path.join(coreDir, "package.json"), "{}");
      await fs.mkdir(path.join(coreDir, "src"), { recursive: true });
      await fs.writeFile(path.join(coreDir, "src/env.ts"), "export const env = {}");

      const pkgs = await findWorkspacePackages(monorepoRoot);
      expect(pkgs).toHaveLength(1);
      expect(pkgs[0]?.dir).toBe(coreDir);
    });

    it("should fallback to recursive scanning if no workspace definitions exist, but filter by contract enabled", async () => {
      const rawRoot = path.join(tempDir, "fallback-repo");
      await fs.mkdir(rawRoot, { recursive: true });

      // packages/one (enabled)
      const oneDir = path.join(rawRoot, "packages/one");
      await fs.mkdir(oneDir, { recursive: true });
      await fs.writeFile(path.join(oneDir, "package.json"), "{}");
      await fs.mkdir(path.join(oneDir, "src"), { recursive: true });
      await fs.writeFile(path.join(oneDir, "src/env.ts"), "export const env = {}");

      // packages/two (plain, ignored)
      const twoDir = path.join(rawRoot, "packages/two");
      await fs.mkdir(twoDir, { recursive: true });
      await fs.writeFile(path.join(twoDir, "package.json"), "{}");

      const pkgs = await findWorkspacePackages(rawRoot);
      expect(pkgs).toHaveLength(1);
      expect(pkgs[0]?.dir).toBe(oneDir);
    });
  });
});
