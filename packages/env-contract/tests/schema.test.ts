import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findSchemaFile } from "../src/utils/file.js";
import { loadSchema } from "../src/core/load-schema.js";
import { zodLoader } from "../src/loaders/zod.js";
import { t3EnvLoader } from "../src/loaders/t3-env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Schema Auto-detection & Loading Reliability", () => {
  const tempDir = path.resolve(__dirname, "./temp-schema-test");

  beforeAll(async () => {
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("findSchemaFile auto-detection priority", () => {
    it("should resolve src/env.ts first if it exists", async () => {
      const caseDir = path.join(tempDir, "case1");
      await fs.mkdir(path.join(caseDir, "src/env"), { recursive: true });
      
      await fs.writeFile(path.join(caseDir, "src/env.ts"), "export const env = {}");
      await fs.writeFile(path.join(caseDir, "src/env/index.ts"), "export const env = {}");
      await fs.writeFile(path.join(caseDir, "env.ts"), "export const env = {}");

      const resolved = await findSchemaFile(caseDir);
      expect(resolved).toBe(path.join(caseDir, "src/env.ts"));
    });

    it("should resolve src/env/index.ts second if src/env.ts does not exist", async () => {
      const caseDir = path.join(tempDir, "case2");
      await fs.mkdir(path.join(caseDir, "src/env"), { recursive: true });
      
      await fs.writeFile(path.join(caseDir, "src/env/index.ts"), "export const env = {}");
      await fs.writeFile(path.join(caseDir, "env.ts"), "export const env = {}");

      const resolved = await findSchemaFile(caseDir);
      expect(resolved).toBe(path.join(caseDir, "src/env/index.ts"));
    });

    it("should resolve env.ts third if src candidate files do not exist", async () => {
      const caseDir = path.join(tempDir, "case3");
      await fs.mkdir(caseDir, { recursive: true });
      
      await fs.writeFile(path.join(caseDir, "env.ts"), "export const env = {}");

      const resolved = await findSchemaFile(caseDir);
      expect(resolved).toBe(path.join(caseDir, "env.ts"));
    });

    it("should fallback to src/env.ts default if no files exist", async () => {
      const caseDir = path.join(tempDir, "case4");
      await fs.mkdir(caseDir, { recursive: true });

      const resolved = await findSchemaFile(caseDir);
      expect(resolved).toBe(path.join(caseDir, "src/env.ts"));
    });
  });

  describe("Zod v3 and Zod v4 structures (def vs _def)", () => {
    it("should match and introspect a schema structure using _def (Zod v3 style)", () => {
      const mockZodV3Schema = {
        _def: {
          typeName: "ZodObject",
        },
        shape: {
          PORT: {
            _def: {
              typeName: "ZodNumber",
            },
          },
          DATABASE_URL: {
            _def: {
              typeName: "ZodString",
              checks: [{ kind: "url" }],
            },
          },
        },
        parse: () => {},
        safeParse: () => {},
      };

      expect(zodLoader.matches(mockZodV3Schema)).toBe(true);
      const schema = zodLoader.introspect(mockZodV3Schema);
      expect(schema.entries).toHaveLength(2);
      expect(schema.entries).toContainEqual({
        key: "PORT",
        type: "number",
        optional: false,
        scope: "server",
      });
      expect(schema.entries).toContainEqual({
        key: "DATABASE_URL",
        type: "url",
        optional: false,
        scope: "server",
      });
    });

    it("should match and introspect a schema structure using def (Zod v4 style)", () => {
      const mockZodV4Schema = {
        def: {
          type: "object",
        },
        shape: {
          API_KEY: {
            def: {
              type: "string",
            },
          },
          DEBUG: {
            def: {
              type: "boolean",
            },
          },
        },
        parse: () => {},
        safeParse: () => {},
      };

      expect(zodLoader.matches(mockZodV4Schema)).toBe(true);
      const schema = zodLoader.introspect(mockZodV4Schema);
      expect(schema.entries).toHaveLength(2);
      expect(schema.entries).toContainEqual({
        key: "API_KEY",
        type: "string",
        optional: false,
        scope: "server",
      });
      expect(schema.entries).toContainEqual({
        key: "DEBUG",
        type: "boolean",
        optional: false,
        scope: "server",
      });
    });
  });

  describe("t3-env client-prefix scopes", () => {
    it("should match and introspect a t3-env schema", () => {
      const mockT3Schema = {
        _def: {},
        _server: {
          _def: { typeName: "ZodObject" },
          shape: {
            DATABASE_URL: { _def: { typeName: "ZodString", checks: [{ kind: "url" }] } }
          },
          parse: () => {},
          safeParse: () => {}
        },
        _client: {
          _def: { typeName: "ZodObject" },
          shape: {
            NEXT_PUBLIC_API_URL: { _def: { typeName: "ZodString", checks: [{ kind: "url" }] } }
          },
          parse: () => {},
          safeParse: () => {}
        }
      };

      expect(t3EnvLoader.matches(mockT3Schema)).toBe(true);
      const schema = t3EnvLoader.introspect(mockT3Schema);
      expect(schema.entries).toHaveLength(2);
      expect(schema.entries).toContainEqual({
        key: "DATABASE_URL",
        type: "url",
        optional: false,
        scope: "server"
      });
      expect(schema.entries).toContainEqual({
        key: "NEXT_PUBLIC_API_URL",
        type: "url",
        optional: false,
        scope: "client"
      });
    });
  });

  describe("Export priority: envSchema vs env vs default", () => {
    it("should prioritize envSchema over env and default, preventing runtime validation crashes", async () => {
      const caseDir = path.join(tempDir, "priority");
      await fs.mkdir(caseDir, { recursive: true });

      const fileContent = `
        // Mock Zod-like object for envSchema
        export const envSchema = {
          _def: { typeName: "ZodObject" },
          shape: {
            DATABASE_URL: { _def: { typeName: "ZodString", checks: [{ kind: "url" }] } }
          },
          parse: () => {},
          safeParse: () => {}
        };

        // env that would throw when loaded/instantiated due to missing environment variables at runtime
        export const env = {
          get DATABASE_URL() {
            throw new Error("Missing DATABASE_URL environment variable!");
          }
        };

        export default {
          isDefaultExport: true
        };
      `;

      const schemaFile = path.join(caseDir, "env.ts");
      await fs.writeFile(schemaFile, fileContent, "utf-8");

      const schema = await loadSchema(schemaFile);
      expect(schema.entries).toHaveLength(1);
      expect(schema.entries[0]).toEqual({
        key: "DATABASE_URL",
        type: "url",
        optional: false,
        scope: "server"
      });
    });
  });
});
