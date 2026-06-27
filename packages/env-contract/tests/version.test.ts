import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { version } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(here, "../package.json"), "utf-8")) as {
  version: string;
};

describe("version", () => {
  it("is sourced from package.json, not a hardcoded literal", () => {
    expect(version).toBe(pkg.version);
  });
});
