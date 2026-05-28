import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { scanSource, globToRegex } from "../src/core/scan-source.js";

describe("globToRegex matcher", () => {
  it("should match standard extensions", () => {
    const rx = globToRegex("**/*.ts");
    expect(rx.test("src/index.ts")).toBe(true);
    expect(rx.test("src/commands/sync.ts")).toBe(true);
    expect(rx.test("index.ts")).toBe(true);
    expect(rx.test("src/index.js")).toBe(false);
  });

  it("should match brace options", () => {
    const rx = globToRegex("**/*.{ts,tsx}");
    expect(rx.test("src/index.ts")).toBe(true);
    expect(rx.test("src/index.tsx")).toBe(true);
    expect(rx.test("src/index.js")).toBe(false);
  });

  it("should match exact folders", () => {
    const rx = globToRegex("**/node_modules/**");
    expect(rx.test("node_modules/some-dep/index.js")).toBe(true);
    expect(rx.test("src/node_modules/some-dep/index.js")).toBe(true);
    expect(rx.test("src/index.ts")).toBe(false);
  });
});

describe("AST Scanner Golden Patterns", () => {
  const tempDir = path.resolve(__dirname, "./temp-scan-test");

  beforeAll(async () => {
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("should identify every AST environment reference pattern", async () => {
    const fileContent = `
      // 1. process.env.DATABASE_URL
      const dbUrl = process.env.DATABASE_URL;

      // 2. process.env["PORT"] / process.env['JWT_SECRET']
      const port = process.env["PORT"];
      const secret = process.env['JWT_SECRET'];

      // 3. process.env?.OPTIONAL_URL
      const optUrl = process.env?.OPTIONAL_URL;

      // 4. process.env?.[ "OPTIONAL_PORT" ]
      const optPort = process.env?.[ "OPTIONAL_PORT" ];

      // 5. import.meta.env.VITE_API_URL
      const apiUrl = import.meta.env.VITE_API_URL;
      const apiSecret = import.meta.env?.VITE_API_SECRET;

      // 6. Destructuring
      const { STRIPE_KEY, STRIPE_WEBHOOK } = process.env;
      const { VITE_CLIENT_KEY } = import.meta.env;

      // 7. Dynamic access (Computed Expression not StringLiteral)
      const dynamicKey = "SOME_KEY";
      const val1 = process.env[dynamicKey];
      const val2 = import.meta.env[dynamicKey];

      // 8. Object.keys / values / entries dynamic detection
      const keys = Object.keys(process.env);
      const values = Object.values(process.env);
      const entries = Object.entries(import.meta.env);
    `;

    const testFile = path.join(tempDir, "golden.ts");
    await fs.writeFile(testFile, fileContent, "utf-8");

    const report = await scanSource(tempDir);
    expect(report.warnings).toHaveLength(0);

    // Verify References
    const keys = report.references.map(r => r.key);
    expect(keys).toContain("DATABASE_URL");
    expect(keys).toContain("PORT");
    expect(keys).toContain("JWT_SECRET");
    expect(keys).toContain("OPTIONAL_URL");
    expect(keys).toContain("OPTIONAL_PORT");
    expect(keys).toContain("VITE_API_URL");
    expect(keys).toContain("VITE_API_SECRET");
    expect(keys).toContain("STRIPE_KEY");
    expect(keys).toContain("STRIPE_WEBHOOK");
    expect(keys).toContain("VITE_CLIENT_KEY");

    // Verify kinds
    const stripeKeyRef = report.references.find(r => r.key === "STRIPE_KEY");
    expect(stripeKeyRef?.kind).toBe("destructure");

    const dbRef = report.references.find(r => r.key === "DATABASE_URL");
    expect(dbRef?.kind).toBe("process.env");

    const viteRef = report.references.find(r => r.key === "VITE_API_URL");
    expect(viteRef?.kind).toBe("import.meta.env");

    // Verify Dynamic References
    expect(report.dynamic).toHaveLength(5); // 2 dynamic accesses + Object.keys, values, entries
    const snippets = report.dynamic.map(d => d.snippet);
    expect(snippets.some(s => s.includes("process.env[dynamicKey]"))).toBe(true);
    expect(snippets.some(s => s.includes("Object.keys(process.env)"))).toBe(true);
    expect(snippets.some(s => s.includes("Object.entries(import.meta.env)"))).toBe(true);
  });

  it("should return parse errors as structured warnings", async () => {
    const brokenContent = `
      const a = ; // Syntax error
    `;
    const testFile = path.join(tempDir, "broken.ts");
    await fs.writeFile(testFile, brokenContent, "utf-8");

    const report = await scanSource(tempDir);
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0]?.file).toBe("broken.ts");
    expect(report.warnings[0]?.message).toContain("Unexpected token");
  });
});
