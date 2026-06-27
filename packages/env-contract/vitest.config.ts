import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Mirror the build-time version injection (see tsup.config.ts) so source imported
// directly by tests resolves `__VERSION__` to the package.json version.
const pkg = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf-8"),
) as { version: string };

export default defineConfig({
  define: { __VERSION__: JSON.stringify(pkg.version) },
});
