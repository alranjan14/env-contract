import { describe, it, expect } from "vitest";
import { diff, parseEnvKeys } from "../src/core/diff.js";
import type { Schema } from "../src/loaders/types.js";

describe("diff logic", () => {
  const schema: Schema = {
    entries: [
      { key: "KEY_A", type: "string", optional: false, scope: "server" },
      { key: "KEY_B", type: "string", optional: false, scope: "server" },
    ],
  };

  it("should detect missing keys in example", () => {
    const exampleKeys = ["KEY_A"];
    const report = diff(schema, exampleKeys, []);

    expect(report.exampleDrift.missingInExample).toContain("KEY_B");
    expect(report.exampleDrift.extraInExample).toHaveLength(0);
  });

  it("should detect extra keys in example", () => {
    const exampleKeys = ["KEY_A", "KEY_B", "KEY_C"];
    const report = diff(schema, exampleKeys, []);

    expect(report.exampleDrift.extraInExample).toContain("KEY_C");
    expect(report.exampleDrift.missingInExample).toHaveLength(0);
  });

  it("should detect orphaned code references", () => {
    const refs = [
      { key: "KEY_A", file: "a.ts", line: 1, column: 1, kind: "process.env" as const },
      { key: "KEY_UNKNOWN", file: "b.ts", line: 2, column: 1, kind: "process.env" as const },
    ];
    const report = diff(schema, ["KEY_A", "KEY_B"], refs);

    expect(report.orphanedRefs).toHaveLength(1);
    expect(report.orphanedRefs[0]?.key).toBe("KEY_UNKNOWN");
  });

  it("should detect unused schema keys in strict mode", () => {
    const refs = [{ key: "KEY_A", file: "a.ts", line: 1, column: 1, kind: "process.env" as const }];
    const report = diff(schema, ["KEY_A", "KEY_B"], refs, { strict: true });

    expect(report.unusedSchemaKeys).toContain("KEY_B");
  });

  it("should filter out ignoreKeys from all reports", () => {
    const refs = [
      { key: "KEY_A", file: "a.ts", line: 1, column: 1, kind: "process.env" as const },
      { key: "NODE_ENV", file: "b.ts", line: 2, column: 1, kind: "process.env" as const },
      { key: "CI", file: "c.ts", line: 3, column: 1, kind: "process.env" as const },
    ];
    // schema has KEY_A, KEY_B
    // example has KEY_A, NODE_ENV
    // refs has KEY_A, NODE_ENV, CI
    // ignoreKeys = ["NODE_ENV", "CI", "KEY_B"]
    const report = diff(schema, ["KEY_A", "NODE_ENV"], refs, {
      strict: true,
      ignoreKeys: ["NODE_ENV", "CI", "KEY_B"],
    });

    // Example drift:
    // KEY_B is missing from example, but it's ignored
    expect(report.exampleDrift.missingInExample).not.toContain("KEY_B");
    // NODE_ENV is extra in example, but it's ignored
    expect(report.exampleDrift.extraInExample).not.toContain("NODE_ENV");

    // Orphaned refs:
    // NODE_ENV and CI are not in schema, but they are ignored
    expect(report.orphanedRefs.map((r) => r.key)).not.toContain("NODE_ENV");
    expect(report.orphanedRefs.map((r) => r.key)).not.toContain("CI");

    // Unused schema keys:
    // KEY_B is in schema but not referenced, but it's ignored
    expect(report.unusedSchemaKeys).not.toContain("KEY_B");
  });

  it("should parse env keys from string", () => {
    const content = `
# Comment
VAR_A=value
VAR_B=
`;
    const keys = parseEnvKeys(content);
    expect(keys).toEqual(["VAR_A", "VAR_B"]);
  });
});
