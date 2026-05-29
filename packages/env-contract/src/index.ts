export * from "./config.js";
export { loadSchema } from "./core/load-schema.js";
export * from "./loaders/types.js";

// Programmatic API
export { scan } from "./core/scan-programmatic.js";
export { check } from "./core/check-programmatic.js";
export { generateExample } from "./core/generate-example.js";

// Core Engine Primitives
export * from "./core/diff.js";
export * from "./core/scan-source.js";

export const version = "0.1.0";
