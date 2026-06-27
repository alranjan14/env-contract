import { describe, it, expect, vi, afterEach } from "vitest";
import { makeLogger } from "../src/utils/logger.js";

describe("makeLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes info to stdout in normal mode", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    makeLogger().info("hi");
    expect(log).toHaveBeenCalledWith("hi");
  });

  it("suppresses info in json mode (no stdout contamination)", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    makeLogger({ json: true }).info("noise");
    expect(log).not.toHaveBeenCalled();
  });

  it("suppresses info in silent mode", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    makeLogger({ silent: true }).info("noise");
    expect(log).not.toHaveBeenCalled();
  });

  it("writes machine output to stdout even in json mode", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    makeLogger({ json: true }).output('{"ok":true}');
    expect(log).toHaveBeenCalledWith('{"ok":true}');
  });

  it("writes errors to stderr even in silent mode", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    makeLogger({ silent: true }).error("boom");
    expect(err).toHaveBeenCalledWith("boom");
  });
});
