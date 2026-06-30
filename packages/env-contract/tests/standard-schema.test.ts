import { describe, it, expect } from "vitest";
import {
  isStandardSchema,
  introspectStandardSchema,
  standardSchemaLoader,
} from "../src/loaders/standard-schema.js";

// A minimal Standard Schema v1 validator for an object schema, from a vendor we
// do NOT have a dedicated loader for — so this exercises the generic adapter
// rather than the Zod/Valibot/ArkType paths. `validate({})` reports an issue per
// missing required key (path: [key]); a clean object returns { value }.
function makeObjectSchema(required: string[], async = false): unknown {
  const validate = (value: unknown) => {
    const obj = (value ?? {}) as Record<string, unknown>;
    const issues = required
      .filter((k) => obj[k] === undefined)
      .map((k) => ({ message: `Required: ${k}`, path: [k] }));
    const result = issues.length > 0 ? { issues } : { value: obj };
    return async ? Promise.resolve(result) : result;
  };
  return { "~standard": { version: 1, vendor: "custom-validator", validate } };
}

describe("standard-schema generic loader", () => {
  it("matches any Standard Schema v1 validator, and nothing else", () => {
    expect(isStandardSchema(makeObjectSchema(["A"]))).toBe(true);
    expect(isStandardSchema({})).toBe(false);
    expect(isStandardSchema(null)).toBe(false);
    expect(isStandardSchema("nope")).toBe(false);
    expect(isStandardSchema({ "~standard": { version: 1 } })).toBe(false); // no validate
    expect(isStandardSchema({ "~standard": { version: 2, validate: () => ({}) } })).toBe(false);
  });

  it("recovers required keys by validating an empty object", () => {
    const { entries } = introspectStandardSchema(makeObjectSchema(["DATABASE_URL", "PORT"]));
    expect(entries.map((e) => e.key).sort()).toEqual(["DATABASE_URL", "PORT"]);
    expect(entries.every((e) => e.optional === false && e.scope === "server")).toBe(true);
  });

  it("normalizes the { key } path-segment form", () => {
    const schema = {
      "~standard": {
        version: 1,
        vendor: "custom",
        validate: () => ({ issues: [{ message: "x", path: [{ key: "NESTED_KEY" }] }] }),
      },
    };
    expect(introspectStandardSchema(schema).entries.map((e) => e.key)).toEqual(["NESTED_KEY"]);
  });

  it("returns no entries when the empty object validates (optional keys are undiscoverable)", () => {
    // A schema with no required keys validates {} cleanly. Optional keys never
    // error on absence, so they cannot be recovered through validation alone.
    expect(introspectStandardSchema(makeObjectSchema([])).entries).toEqual([]);
  });

  it("throws a clear error for asynchronous validators", () => {
    expect(() => introspectStandardSchema(makeObjectSchema(["A"], true))).toThrow(
      /asynchronous validation/,
    );
  });

  it("is exposed as a SchemaLoader", () => {
    expect(typeof standardSchemaLoader.matches).toBe("function");
    expect(typeof standardSchemaLoader.introspect).toBe("function");
  });
});
