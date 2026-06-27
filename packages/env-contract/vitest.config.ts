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
      // Floors set below current (lines ~83, funcs ~90, branches ~70) so a real
      // regression trips the gate without churn on small changes. Raise over time.
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 85,
        branches: 65,
      },
    },
  },
});
