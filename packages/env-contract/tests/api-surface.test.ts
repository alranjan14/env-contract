import { describe, it, expect } from "vitest";
import * as api from "../src/index.js";

// Locks the published runtime export surface. Adding or removing a public export
// should be a deliberate change that updates this list (types are erased at
// runtime, so only value exports appear here).
describe("public API surface", () => {
  it("exports exactly the supported runtime entry points", () => {
    expect(Object.keys(api).sort()).toEqual(
      [
        "check",
        "computeKeyDrift",
        "defineConfig",
        "diff",
        "generateExample",
        "loadSchema",
        "parseEnvKeys",
        "scan",
        "scanSource",
        "version",
      ].sort(),
    );
  });
});
