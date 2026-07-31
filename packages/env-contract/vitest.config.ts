import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Mirror the build-time version injection (see tsup.config.ts) so source imported
// directly by tests resolves `__VERSION__` to the package.json version.
const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf-8")) as {
  version: string;
};

export default defineConfig({
  define: { __VERSION__: JSON.stringify(pkg.version) },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      // cli.ts is the bin entrypoint, exercised by the e2e suite which spawns the
      // built CLI in a child process — it can't be instrumented in-process.
      exclude: ["src/cli.ts"],
      // Floors a few points below current under the coverage-v8 v4 measurement
      // (stmts ~80, lines ~82, funcs ~91, branches ~68). v4's v8 remapping reports
      // a bit lower than v1 for identical tests, so these were re-baselined with
      // the vitest 4 upgrade — not a coverage regression. Ratchet up as it grows.
      thresholds: {
        lines: 80,
        statements: 78,
        functions: 88,
        branches: 66,
      },
    },
  },
});
