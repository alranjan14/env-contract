import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Single source of truth for the version: package.json. Injected at build time
// so `--version` can never drift from the published package version.
const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf-8")) as {
  version: string;
};

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  target: "node22",
  minify: false,
  shims: true,
  define: { __VERSION__: JSON.stringify(pkg.version) },
});
