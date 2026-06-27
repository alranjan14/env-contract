import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSchema, scan, check } from "../src/index.js";
import { runSync } from "../src/commands/sync.js";
import { runScan } from "../src/commands/scan.js";
import { runCheck } from "../src/commands/check.js";
import type { ScanReportData } from "../src/reporters/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "./fixtures");

describe("Realistic Fixtures Integrations (P2)", () => {
  describe("basic-zod", () => {
    const cwd = path.join(FIXTURES_DIR, "basic-zod");

    it("should load the plain Zod schema correctly", async () => {
      const schemaPath = path.join(cwd, "src/env.ts");
      const result = await loadSchema(schemaPath);
      
      expect(result.entries).toHaveLength(3);
      expect(result.entries).toContainEqual({
        key: "PORT",
        type: "string",
        optional: true,
        scope: "server",
        default: "3000",
      });
      expect(result.entries).toContainEqual({
        key: "DATABASE_URL",
        type: "url",
        optional: false,
        scope: "server",
        description: "The Postgres connection string",
      });
      expect(result.entries).toContainEqual({
        key: "API_KEY",
        type: "string",
        optional: true,
        scope: "server",
      });
    });

    it("should scan code references successfully", async () => {
      const scanResult = await scan({
        root: path.join(cwd, "src"),
        cwd,
      });

      const keys = scanResult.references.map((r) => r.key);
      expect(keys).toContain("PORT");
      expect(keys).toContain("DATABASE_URL");
      expect(keys).toContain("API_KEY");
      expect(scanResult.dynamic).toHaveLength(0);
      expect(scanResult.warnings).toHaveLength(0);
    });

    it("should verify env contract health cleanly", async () => {
      const report = await check({ cwd });
      expect(report.ok).toBe(true);
      expect(report.exampleDrift.missingInExample).toHaveLength(0);
      expect(report.exampleDrift.extraInExample).toHaveLength(0);
      expect(report.orphanedRefs).toHaveLength(0);
    });
  });

  describe("t3-env-nextjs", () => {
    const cwd = path.join(FIXTURES_DIR, "t3-env-nextjs");

    it("should introspect server and client scopes separately", async () => {
      const schemaPath = path.join(cwd, "src/env.ts");
      const result = await loadSchema(schemaPath);

      expect(result.entries).toHaveLength(2);
      expect(result.entries).toContainEqual({
        key: "DATABASE_URL",
        type: "url",
        optional: false,
        scope: "server",
        description: "Production postgres database link",
      });
      expect(result.entries).toContainEqual({
        key: "NEXT_PUBLIC_API_URL",
        type: "url",
        optional: false,
        scope: "client",
        description: "Frontend API gateway",
      });
    });

    it("should check and pass a synchronized Next.js project", async () => {
      const report = await check({ cwd });
      expect(report.ok).toBe(true);
      expect(report.exampleDrift.missingInExample).toHaveLength(0);
      expect(report.exampleDrift.extraInExample).toHaveLength(0);
      expect(report.orphanedRefs).toHaveLength(0);
    });
  });

  describe("t3-env-with-presets", () => {
    const cwd = path.join(FIXTURES_DIR, "t3-env-with-presets");

    it("should load the schema structure with presets successfully", async () => {
      const schemaPath = path.join(cwd, "src/env.ts");
      const result = await loadSchema(schemaPath);
      expect(result.entries).toHaveLength(2);
    });
  });

  describe("orphan-refs", () => {
    const cwd = path.join(FIXTURES_DIR, "orphan-refs");

    it("should correctly detect orphaned process.env references", async () => {
      const report = await check({ cwd });
      expect(report.ok).toBe(false);
      expect(report.orphanedRefs).toHaveLength(1);
      expect(report.orphanedRefs[0]?.key).toBe("SECRET_API_TOKEN");
    });
  });

  describe("empty-project", () => {
    const cwd = path.join(FIXTURES_DIR, "empty-project");

    it("should gracefully handle checks on empty directory by rejecting missing schemas", async () => {
      await expect(check({ cwd })).rejects.toThrow();
    });
  });

  describe("parse-error", () => {
    const cwd = path.join(FIXTURES_DIR, "parse-error");

    it("should capture syntax errors as structured scanner warnings without crashing", async () => {
      const scanResult = await scan({
        root: path.join(cwd, "src"),
        cwd,
      });

      expect(scanResult.warnings).toHaveLength(1);
      expect(scanResult.warnings[0]?.file).toBe("src/index.ts");
      expect(scanResult.warnings[0]?.message).toContain("Unexpected token");
    });
  });

  describe("monorepo workspace mode", () => {
    const cwd = path.join(FIXTURES_DIR, "monorepo");

    it("should perform aggregated scan across monorepo packages", async () => {
      const result = await runScan({
        workspace: true,
        cwd,
        silent: true,
      });

      expect(result.code).toBe(0);
      expect(result.data).toHaveLength(2);

      const reports = result.data as ScanReportData[];
      const webRep = reports.find((r) => r.package?.endsWith("apps/web"));
      const apiRep = reports.find((r) => r.package?.endsWith("packages/api"));

      expect(webRep).toBeDefined();
      expect(webRep?.orphanedRefs).toHaveLength(0);
      expect(apiRep).toBeDefined();
      expect(apiRep?.orphanedRefs).toHaveLength(0);
    });

    it("should verify aggregated workspace checks correctly", async () => {
      const result = await runCheck({
        workspace: true,
        cwd,
      });

      expect(result.code).toBe(0);
    });

    it("should run sync across monorepo workspace packages", async () => {
      const result = await runSync({
        workspace: true,
        cwd,
        silent: true,
        yes: true,
      });

      expect(result.code).toBe(0);
      expect(result.data).toHaveLength(2);
    });
  });
});
