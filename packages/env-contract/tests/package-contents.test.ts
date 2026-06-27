import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

const PACKAGE_DIR = path.resolve(__dirname, "..");

interface PackedFile {
  path: string;
  size: number;
  mode: number;
}

interface PackResult {
  id: string;
  name: string;
  version: string;
  files: PackedFile[];
}

function runNpmPack(): PackResult {
  const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: PACKAGE_DIR,
    encoding: "utf-8",
  });
  const results = JSON.parse(output) as PackResult[];
  const result = results[0];
  if (!result) throw new Error("`npm pack --json` returned no results");
  return result;
}

describe("Package contents inspection", () => {
  it("should contain only the intended files for publishing", () => {
    const packResult = runNpmPack();
    const files = packResult.files.map((f) => f.path);

    // 1. Core package metadata files must be present
    expect(files).toContain("LICENSE");
    expect(files).toContain("CHANGELOG.md");
    expect(files).toContain("README.md");
    expect(files).toContain("package.json");

    // 2. Build artifacts (dist/) must be present
    const distFiles = files.filter((f) => f.startsWith("dist/"));
    expect(distFiles.length).toBeGreaterThan(0);

    // 3. No source directory, test directory, or local scratch scripts should leak
    const invalidFiles = files.filter(
      (f) =>
        f.startsWith("src/") ||
        f.startsWith("tests/") ||
        f.startsWith("scratch/") ||
        f.includes(".test.") ||
        f.endsWith("test_cli_fail.ts") ||
        f.endsWith("test_template.ts") ||
        f.endsWith("test-output.txt")
    );

    expect(invalidFiles).toEqual([]);

    // 4. Ensure all files belong to allowed top-level directories/files
    const allowedRoots = ["dist/", "LICENSE", "CHANGELOG.md", "README.md", "package.json"];
    const unexpectedFiles = files.filter(
      (f) => !allowedRoots.some((allowed) => f === allowed || f.startsWith(allowed))
    );

    expect(unexpectedFiles).toEqual([]);
  });
});
