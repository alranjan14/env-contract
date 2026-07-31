import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Single source of truth for the version: package.json. Injected at build time
// so `--version` can never drift from the published package version.
const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf-8")) as {
  version: string;
};

const shared = {
  splitting: false,
  sourcemap: true,
  target: "node22",
  minify: false,
  shims: true,
  define: { __VERSION__: JSON.stringify(pkg.version) },
};

export default defineConfig([
  {
    // Library entry: dual ESM + CJS with type declarations (see package.json
    // "exports").
    ...shared,
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
  },
  {
    // CLI bin: ESM-only. It runs as `dist/cli.js` (the "bin" target) and is never
    // `require()`d, and its cac dependency is ESM-only — so a CJS build would be
    // both dead weight and unloadable. `clean: false` preserves the library build
    // above (this config runs after it).
    ...shared,
    entry: ["src/cli.ts"],
    format: ["esm"],
    dts: false,
    clean: false,
  },
]);
