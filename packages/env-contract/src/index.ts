// Replaced at build time (tsup `define`) and in tests (vitest `define`) with the
// version from package.json — the single source of truth. Declared so `tsc` and
// the type emit see a plain string.
declare const __VERSION__: string;

// Configuration
export { defineConfig } from "./config.js";
export type { Config } from "./config.js";

// Schema loading
export { loadSchema } from "./core/load-schema.js";
export type { Schema, SchemaEntry, SchemaLoader } from "./loaders/types.js";

// Programmatic API
export { scan } from "./core/scan-programmatic.js";
export { check } from "./core/check-programmatic.js";
export { generateExample } from "./core/generate-example.js";

// Core engine primitives (stable, supported surface)
export { diff, computeKeyDrift, parseEnvKeys } from "./core/diff.js";
export type { DiffReport } from "./core/diff.js";
export { scanSource } from "./core/scan-source.js";
export type { Reference, DynamicReference, ScanReport } from "./core/scan-source.js";

export const version: string = __VERSION__;
