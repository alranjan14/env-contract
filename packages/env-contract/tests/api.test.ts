import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSchema, generateExample, scan, check } from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Programmatic API Alignment", () => {
  const tempDir = path.resolve(__dirname, "./temp-api-test");

  beforeAll(async () => {
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("loadSchema Options Argument", () => {
    it("should resolve schema using the object configuration form", async () => {
      const caseDir = path.join(tempDir, "load-opt");
      await fs.mkdir(caseDir, { recursive: true });
      await fs.writeFile(
        path.join(caseDir, "env.ts"),
        `
        export const envSchema = {
          _def: { typeName: "ZodObject" },
          shape: { PORT: { _def: { typeName: "ZodNumber" } } },
          parse: () => {},
          safeParse: () => {}
        };
        `
      );

      const schema = await loadSchema({ path: "env.ts", cwd: caseDir });
      expect(schema.entries).toHaveLength(1);
      expect(schema.entries[0]?.key).toBe("PORT");
    });
  });

  describe("generateExample options.managedBlock", () => {
    it("should return raw content by default", () => {
      const schema = {
        entries: [{ key: "PORT", type: "number", optional: false, scope: "server" as const }]
      };
      const result = generateExample(schema);
      expect(result).not.toContain("env-contract:start");
      expect(result).toBe("# number\nPORT=");
    });

    it("should return content wrapped in managed block markers when managedBlock option is true", () => {
      const schema = {
        entries: [{ key: "PORT", type: "number", optional: false, scope: "server" as const }]
      };
      const result = generateExample(schema, { managedBlock: true });
      expect(result).toContain("# >>> env-contract:start (do not edit this block manually)");
      expect(result).toContain("# <<< env-contract:end");
      expect(result).toContain("PORT=");
    });
  });

  describe("scan programmatic API", () => {
    it("should scan references and return grouped references", async () => {
      const caseDir = path.join(tempDir, "scan-api");
      await fs.mkdir(caseDir, { recursive: true });
      await fs.writeFile(
        path.join(caseDir, "index.ts"),
        `
        const db = process.env.DATABASE_URL;
        const port = process.env.PORT;
        const anotherDb = process.env.DATABASE_URL;
        `
      );

      const result = await scan({ root: caseDir, patterns: ["**/*.ts"] });
      expect(result.references).toHaveLength(3);
      expect(result.dynamic).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);

      // Verify grouped references
      expect(result.grouped["DATABASE_URL"]).toHaveLength(2);
      expect(result.grouped["PORT"]).toHaveLength(1);
    });
  });

  describe("check programmatic API", () => {
    it("should run full check and return structured report without exiting or logging", async () => {
      const caseDir = path.join(tempDir, "check-api");
      await fs.mkdir(caseDir, { recursive: true });

      // Create env.ts
      await fs.writeFile(
        path.join(caseDir, "env.ts"),
        `
        export const envSchema = {
          _def: { typeName: "ZodObject" },
          shape: { DATABASE_URL: { _def: { typeName: "ZodString" } } },
          parse: () => {},
          safeParse: () => {}
        };
        `
      );

      // Create .env.example with correct block
      const exampleContent = `
# >>> env-contract:start (do not edit this block manually)
# Generated from schema. Run \`env-contract sync\` to update.

# string
DATABASE_URL=
# <<< env-contract:end
      `;
      await fs.writeFile(path.join(caseDir, ".env.example"), exampleContent);

      // Create index.ts referencing it
      await fs.writeFile(
        path.join(caseDir, "index.ts"),
        `const db = process.env.DATABASE_URL;`
      );

      // Configure config
      await fs.writeFile(
        path.join(caseDir, "env-contract.config.ts"),
        `
        export default {
          schema: "env.ts",
          exampleFile: ".env.example",
          rootDir: "."
        };
        `
      );

      const report = await check({ cwd: caseDir });
      expect(report.ok).toBe(true);
      expect(report.exampleDrift.missingInExample).toHaveLength(0);
      expect(report.exampleDrift.extraInExample).toHaveLength(0);
      expect(report.orphanedRefs).toHaveLength(0);
    });

    it("should flag ok=false if sync drift is present", async () => {
      const caseDir = path.join(tempDir, "check-drift");
      await fs.mkdir(caseDir, { recursive: true });

      await fs.writeFile(
        path.join(caseDir, "env.ts"),
        `
        export const envSchema = {
          _def: { typeName: "ZodObject" },
          shape: { PORT: { _def: { typeName: "ZodNumber" } } },
          parse: () => {},
          safeParse: () => {}
        };
        `
      );
      // Empty example
      await fs.writeFile(path.join(caseDir, ".env.example"), "");
      await fs.writeFile(path.join(caseDir, "index.ts"), "const port = process.env.PORT;");

      await fs.writeFile(
        path.join(caseDir, "env-contract.config.ts"),
        `
        export default {
          schema: "env.ts",
          exampleFile: ".env.example",
          rootDir: "."
        };
        `
      );

      const report = await check({ cwd: caseDir });
      expect(report.ok).toBe(false);
      expect(report.exampleDrift.missingInExample).toContain("PORT");
    });
  });
});
