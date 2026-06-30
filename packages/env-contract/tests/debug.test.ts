import { describe, it, expect, vi, afterEach } from "vitest";
import { isDebugEnabled, makeDebug } from "../src/utils/debug.js";

describe("debug channel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isDebugEnabled", () => {
    it("is on when --debug is set, regardless of env", () => {
      expect(isDebugEnabled(true, undefined)).toBe(true);
      expect(isDebugEnabled(true, "")).toBe(true);
      expect(isDebugEnabled(true, "something-unrelated")).toBe(true);
    });

    it("is off when neither the flag nor DEBUG names this tool", () => {
      expect(isDebugEnabled(false, undefined)).toBe(false);
      expect(isDebugEnabled(false, "")).toBe(false);
      expect(isDebugEnabled(false, "express:*")).toBe(false);
      expect(isDebugEnabled(false, "env")).toBe(false);
      expect(isDebugEnabled(false, "envcontract")).toBe(false);
    });

    it("honors DEBUG globs that name this tool", () => {
      expect(isDebugEnabled(false, "env-contract")).toBe(true);
      expect(isDebugEnabled(false, "env-contract*")).toBe(true);
      expect(isDebugEnabled(false, "*")).toBe(true);
      expect(isDebugEnabled(false, "foo,env-contract*")).toBe(true);
      expect(isDebugEnabled(false, "foo bar env-contract")).toBe(true);
    });

    it("treats a negation pattern as a non-match", () => {
      expect(isDebugEnabled(false, "-env-contract")).toBe(false);
    });
  });

  describe("makeDebug", () => {
    it("writes namespaced, timed diagnostics to stderr when enabled", () => {
      let buf = "";
      vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array) => {
        buf += typeof chunk === "string" ? chunk : chunk.toString();
        return true;
      });

      const dbg = makeDebug(true);
      expect(dbg.enabled).toBe(true);
      dbg.log("hello world");
      dbg.timer("some-work")();

      const lines = buf.trim().split("\n");
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain("env-contract hello world");
      expect(lines[0]).toMatch(/\+\d+ms$/);
      expect(lines[1]).toMatch(/^env-contract some-work \(\d+ms\)/);
    });

    it("writes nothing when disabled", () => {
      const prev = process.env.DEBUG;
      delete process.env.DEBUG;
      try {
        const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
        const dbg = makeDebug(false);
        expect(dbg.enabled).toBe(false);
        dbg.log("nope");
        dbg.timer("nope")();
        expect(spy).not.toHaveBeenCalled();
      } finally {
        if (prev !== undefined) process.env.DEBUG = prev;
      }
    });
  });
});
