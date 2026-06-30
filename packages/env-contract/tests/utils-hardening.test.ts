import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { globToRegex } from "../src/core/scan-source.js";
import { parsePnpmWorkspaceYaml } from "../src/utils/workspace.js";
import { showDiff } from "../src/reporters/render-diff.js";

// These utilities are hand-rolled by deliberate design (zero runtime deps). That
// trade-off means we own the edge cases — so they get adversarial coverage here.

describe("globToRegex (hand-rolled glob)", () => {
  const matches = (pattern: string, p: string): boolean => globToRegex(pattern).test(p);

  it("matches single-segment wildcards without crossing slashes", () => {
    expect(matches("src/*.ts", "src/index.ts")).toBe(true);
    expect(matches("src/*.ts", "src/nested/index.ts")).toBe(false);
  });

  it("matches a leading **/ at any depth, including depth zero", () => {
    expect(matches("**/*.test.ts", "foo.test.ts")).toBe(true);
    expect(matches("**/*.test.ts", "a/b/foo.test.ts")).toBe(true);
    expect(matches("**/*.test.ts", "foo.ts")).toBe(false);
  });

  it("matches a mid-path /**/ across zero or more directories", () => {
    // Regression: this is the README's documented config pattern; a buggy
    // double-slash translation used to make it match nothing.
    expect(matches("src/**/*.ts", "src/index.ts")).toBe(true);
    expect(matches("src/**/*.ts", "src/a/b.ts")).toBe(true);
    expect(matches("src/**/*.ts", "src/a/b/c.ts")).toBe(true);
    expect(matches("src/**/*.ts", "other/index.ts")).toBe(false);
    // Combined with brace expansion, as the README config recommends.
    expect(matches("src/**/*.{ts,tsx}", "src/index.ts")).toBe(true);
    expect(matches("src/**/*.{ts,tsx}", "src/a/b.tsx")).toBe(true);
  });

  it("expands brace alternation", () => {
    expect(matches("src/*.{ts,tsx}", "src/a.ts")).toBe(true);
    expect(matches("src/*.{ts,tsx}", "src/a.tsx")).toBe(true);
    expect(matches("src/*.{ts,tsx}", "src/a.js")).toBe(false);
  });

  it("treats ? as exactly one non-slash character", () => {
    expect(matches("file?.ts", "file1.ts")).toBe(true);
    expect(matches("file?.ts", "file.ts")).toBe(false);
    expect(matches("file?.ts", "file/.ts")).toBe(false);
  });

  it("escapes regex metacharacters in literal segments (no injection)", () => {
    // A '.' must be literal, not 'any character'.
    expect(matches("a.b.ts", "axbxts")).toBe(false);
    expect(matches("a.b.ts", "a.b.ts")).toBe(true);
    // '+' and parens must be literal too.
    expect(matches("a+(b).ts", "a+(b).ts")).toBe(true);
    expect(matches("a+(b).ts", "aaab.ts")).toBe(false);
  });

  it("anchors the whole path — no partial matches", () => {
    expect(matches("src/index.ts", "x/src/index.ts")).toBe(false);
    expect(matches("src/index.ts", "src/index.tsx")).toBe(false);
  });

  it("normalizes backslashes to forward slashes (Windows-style paths)", () => {
    expect(globToRegex("src\\*.ts").test("src/index.ts")).toBe(true);
  });
});

describe("parsePnpmWorkspaceYaml (supported subset)", () => {
  // Supported subset: a top-level `packages:` key, either as a block sequence
  // (`- 'glob'`) or an inline array (`["glob", ...]`). Anything else is ignored
  // leniently (no throw) so unrecognized pnpm keys don't break discovery.

  it("parses a block-sequence packages list", () => {
    const yaml = ["packages:", "  - 'packages/*'", '  - "apps/*"', "  - tools/*"].join("\n");
    expect(parsePnpmWorkspaceYaml(yaml)).toEqual(["packages/*", "apps/*", "tools/*"]);
  });

  it("parses an inline-array packages list", () => {
    expect(parsePnpmWorkspaceYaml(`packages: ["packages/*", "apps/*"]`)).toEqual([
      "packages/*",
      "apps/*",
    ]);
  });

  it("ignores comments, blank lines, and empty entries", () => {
    const yaml = ["# a comment", "", "packages:", "  - 'packages/*'", "  - ''", ""].join("\n");
    expect(parsePnpmWorkspaceYaml(yaml)).toEqual(["packages/*"]);
  });

  it("stops collecting at the next top-level key (does not bleed into other sections)", () => {
    const yaml = ["packages:", "  - 'packages/*'", "catalog:", "  react: ^18"].join("\n");
    expect(parsePnpmWorkspaceYaml(yaml)).toEqual(["packages/*"]);
  });

  it("returns an empty list when there is no packages key", () => {
    expect(parsePnpmWorkspaceYaml("catalog:\n  react: ^18")).toEqual([]);
    expect(parsePnpmWorkspaceYaml("")).toEqual([]);
  });
});

describe("showDiff (terminal line renderer)", () => {
  let logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const output = (): string => logSpy.mock.calls.map((c) => String(c[0])).join("\n");

  it("does not throw on empty inputs", () => {
    expect(() => showDiff("", "")).not.toThrow();
  });

  it("marks removed lines with '-' and added lines with '+'", () => {
    showDiff("A\nB\nC", "A\nX\nC");
    const out = output();
    expect(out).toContain("- B");
    expect(out).toContain("+ X");
  });

  it("handles a full replacement with no common lines", () => {
    showDiff("OLD1\nOLD2", "NEW1\nNEW2");
    const out = output();
    expect(out).toContain("- OLD1");
    expect(out).toContain("+ NEW1");
  });

  it("handles content -> empty and empty -> content without throwing", () => {
    expect(() => showDiff("A\nB", "")).not.toThrow();
    expect(() => showDiff("", "A\nB")).not.toThrow();
  });

  it("terminates on large divergent inputs beyond the lookahead window", () => {
    const oldC = Array.from({ length: 100 }, (_, i) => `old${i}`).join("\n");
    const newC = Array.from({ length: 100 }, (_, i) => `new${i}`).join("\n");
    expect(() => showDiff(oldC, newC)).not.toThrow();
  });
});
