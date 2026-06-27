import { describe, it, expect } from "vitest";
import * as v from "valibot";
import { valibotLoader } from "../src/loaders/valibot.js";

describe("valibot loader", () => {
  it("should match a valibot object schema", () => {
    const schema = v.object({
      FOO: v.string(),
    });
    expect(valibotLoader.matches(schema)).toBe(true);
  });

  it("should introspect basic string and number types", () => {
    const schema = v.object({
      STR: v.string("String description"),
      NUM: v.number(),
      BOOL: v.boolean(),
    });

    const result = valibotLoader.introspect(schema);

    expect(result.entries).toHaveLength(3);

    expect(result.entries[0]).toEqual({
      key: "STR",
      type: "string",
      description: "String description",
      optional: false,
      scope: "server",
    });

    expect(result.entries[1]?.type).toBe("number");
    expect(result.entries[2]?.type).toBe("boolean");
  });

  it("should introspect optional with default", () => {
    const schema = v.object({
      OPT_NO_DEF: v.optional(v.string()),
      OPT_WITH_DEF: v.optional(v.number(), 3000),
      NULLABLE: v.nullable(v.string()),
    });

    const result = valibotLoader.introspect(schema);

    expect(result.entries[0]).toEqual({
      key: "OPT_NO_DEF",
      type: "string",
      optional: true,
      scope: "server",
    });

    expect(result.entries[1]).toEqual({
      key: "OPT_WITH_DEF",
      type: "number",
      optional: true,
      default: 3000,
      scope: "server",
    });

    expect(result.entries[2]).toEqual({
      key: "NULLABLE",
      type: "string",
      optional: true,
      scope: "server",
    });
  });

  it("should introspect piped schemas", () => {
    const schema = v.object({
      PIPED: v.pipe(v.string(), v.transform(Number)),
    });

    const result = valibotLoader.introspect(schema);

    expect(result.entries[0]).toEqual({
      key: "PIPED",
      type: "string",
      optional: false,
      scope: "server",
    });
  });
});
