import { describe, it, expect } from "vitest";
import { type } from "arktype";
import { arktypeLoader } from "../src/loaders/arktype.js";

describe("arktype loader", () => {
  it("should match an arktype schema", () => {
    const schema = type({
      FOO: "string",
    });
    expect(arktypeLoader.matches(schema)).toBe(true);
  });

  it("should introspect basic string and number types", () => {
    const schema = type({
      STR: "string",
      NUM: "number",
      BOOL: "boolean",
    });

    const result = arktypeLoader.introspect(schema);
    
    expect(result.entries).toHaveLength(3);
    
    expect(result.entries.find(e => e.key === "STR")).toEqual({
      key: "STR",
      type: "string",
      description: "a string",
      optional: false,
      scope: "server",
    });

    expect(result.entries.find(e => e.key === "NUM")?.type).toBe("number");
    expect(result.entries.find(e => e.key === "BOOL")?.type).toBe("boolean");
  });

  it("should introspect optional with default", () => {
    const schema = type({
      "OPT_NO_DEF?": "string",
      OPT_WITH_DEF: ["number", "=", 3000],
    });

    const result = arktypeLoader.introspect(schema);
    
    expect(result.entries.find(e => e.key === "OPT_NO_DEF")).toEqual({
      key: "OPT_NO_DEF",
      type: "string",
      description: "a string",
      optional: true,
      scope: "server",
    });

    expect(result.entries.find(e => e.key === "OPT_WITH_DEF")).toEqual({
      key: "OPT_WITH_DEF",
      type: "number",
      description: "a number",
      optional: true,
      default: 3000,
      scope: "server",
    });
  });

  it("should introspect unions and pipes", () => {
    const schema = type({
      UNION: "string | number",
      PIPED: type("string.email"),
    });

    const result = arktypeLoader.introspect(schema);
    
    expect(result.entries.find(e => e.key === "UNION")?.type).toBe("number | string");
    expect(result.entries.find(e => e.key === "PIPED")?.type).toContain("/^[");
  });
});
