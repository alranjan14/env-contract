import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { resolveConfig } from "../src/config.js";

describe("Config Resolution", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "env-contract-config-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("should return empty object if no config exists", async () => {
    const config = await resolveConfig(tempDir);
    expect(config).toEqual({});
  });

  it("should load from explicit config path", async () => {
    const customConfigPath = path.join(tempDir, "custom.ts");
    await fs.writeFile(
      customConfigPath,
      `export default { schema: "custom.ts" };`
    );
    const config = await resolveConfig(tempDir, customConfigPath);
    expect(config).toEqual({ schema: "custom.ts" });
  });

  it("should fallback to env-contract.config.ts", async () => {
    await fs.writeFile(
      path.join(tempDir, "env-contract.config.ts"),
      `export default { rootDir: "src/app" };`
    );
    const config = await resolveConfig(tempDir);
    expect(config).toEqual({ rootDir: "src/app" });
  });

  it("should fallback to package.json env-contract field", async () => {
    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify({
        "env-contract": {
          ignoreKeys: ["FOO"]
        }
      })
    );
    const config = await resolveConfig(tempDir);
    expect(config).toEqual({ ignoreKeys: ["FOO"] });
  });
});
