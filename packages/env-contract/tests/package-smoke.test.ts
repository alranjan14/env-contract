import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const PACKAGE_DIR = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

type PeerPackage = "zod" | "valibot" | "arktype";

function exec(command: string, args: string[], cwd: string): string {
  const env = { ...process.env };
  delete env.NODE_PATH;
  delete env.npm_config_manage_package_manager_versions;
  delete env.npm_config_recursive;

  return execFileSync(command, args, {
    cwd,
    encoding: "utf-8",
    env: {
      ...env,
      npm_config_audit: "false",
      npm_config_fund: "false",
      npm_config_update_notifier: "false",
    },
  });
}

async function installPackedPackage(peerPackages: PeerPackage[] = []) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "env-contract-smoke-"));
  const packOutput = exec("npm", ["pack", "--silent", "--pack-destination", tmpDir], PACKAGE_DIR);
  const tarballName = packOutput.trim().split(/\r?\n/).at(-1);

  expect(tarballName).toMatch(/^env-contract-.*\.tgz$/);

  const tarballPath = path.join(tmpDir, tarballName!);
  const peerPackagePaths = peerPackages.map((peer) => getPackageRoot(peer));

  await fs.writeFile(path.join(tmpDir, "package.json"), JSON.stringify({ type: "module" }));
  exec("npm", ["install", "--silent", tarballPath, ...peerPackagePaths, "--ignore-scripts"], tmpDir);

  return tmpDir;
}

function getPackageRoot(packageName: PeerPackage): string {
  let current = path.dirname(require.resolve(packageName));

  while (current !== path.dirname(current)) {
    try {
      require.resolve(path.join(current, "package.json"));
      return current;
    } catch {
      current = path.dirname(current);
    }
  }

  throw new Error(`Could not locate package root for ${packageName}`);
}

async function assertPackageFunctional(tmpDir: string) {
  // 1. Assert CJS and ESM imports/requires work
  const importOutput = exec(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import('env-contract').then(() => console.log('import ok'))",
    ],
    tmpDir,
  );
  expect(importOutput).toContain("import ok");

  const requireOutput = exec(
    process.execPath,
    ["-e", "require('env-contract'); console.log('require ok')"],
    tmpDir,
  );
  expect(requireOutput).toContain("require ok");

  // 2. Assert CLI binary execution works
  const cliJsPath = path.join(tmpDir, "node_modules", "env-contract", "dist", "cli.js");
  const cliOutputDirect = exec(process.execPath, [cliJsPath, "--help"], tmpDir);
  expect(cliOutputDirect).toContain("env-contract <command> [options]");

  try {
    const cliOutputNpx = exec("npx", ["env-contract", "--help"], tmpDir);
    expect(cliOutputNpx).toContain("env-contract <command> [options]");
  } catch (err) {
    // If npx is not available in the test runner's environment, we print a warning but don't fail,
    // as direct execution via node is verified above.
    console.warn("Skipping npx bin test wrapper:", err);
  }

  // 3. Assert TypeScript type resolution works in a downstream project
  await fs.writeFile(
    path.join(tmpDir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "Node16",
        moduleResolution: "Node16",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
      },
    }, null, 2),
  );

  await fs.writeFile(
    path.join(tmpDir, "smoke-test.ts"),
    `
import { scan, check, generateExample } from "env-contract";
console.log(typeof scan, typeof check, typeof generateExample);
`,
  );

  let tscPath: string;
  try {
    tscPath = require.resolve("typescript/bin/tsc");
  } catch {
    try {
      tscPath = require.resolve("typescript/lib/tsc.js");
    } catch {
      tscPath = path.resolve(PACKAGE_DIR, "../../node_modules/typescript/bin/tsc");
    }
  }

  const tscOutput = exec(process.execPath, [tscPath, "--noEmit"], tmpDir);
  expect(tscOutput).toBeDefined();
}

describe("published package smoke tests", () => {
  it("can be imported and required without validator peers installed", async () => {
    const tmpDir = await installPackedPackage();

    try {
      for (const peer of ["zod", "valibot", "arktype"]) {
        const missingPeerOutput = exec(
          process.execPath,
          [
            "-e",
            `try { require.resolve(${JSON.stringify(peer)}); process.exit(1); } catch { console.log(${JSON.stringify(`${peer} missing`)}); }`,
          ],
          tmpDir,
        );
        expect(missingPeerOutput).toContain(`${peer} missing`);
      }

      await assertPackageFunctional(tmpDir);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }, 45_000);

  it.each<PeerPackage>(["zod", "valibot", "arktype"])(
    "can be imported and required with %s installed",
    async (peerPackage) => {
      const tmpDir = await installPackedPackage([peerPackage]);

      try {
        await assertPackageFunctional(tmpDir);
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    },
    45_000,
  );
});
