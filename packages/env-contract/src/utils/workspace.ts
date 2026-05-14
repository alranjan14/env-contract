import fs from "node:fs/promises";
import path from "node:path";

export interface WorkspacePackage {
  dir: string;
  type: "config" | "env.ts";
}

export async function findWorkspacePackages(rootDir: string): Promise<WorkspacePackage[]> {
  const packages: WorkspacePackage[] = [];
  const ignoreDirs = new Set(["node_modules", "dist", ".git", ".next", "build", "coverage"]);

  async function walk(dir: string) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (e: any) {
      if (e.code === "ENOENT" || e.code === "EACCES") return;
      throw e;
    }

    let isPackage = false;
    for (const entry of entries) {
      if (entry.name === "package.json") isPackage = true;
    }

    if (isPackage) {
      const configPath = path.join(dir, "env-contract.config.ts");
      const envPath = path.join(dir, "src/env.ts");
      
      let hasConfig = false;
      let hasEnv = false;
      
      try { await fs.access(configPath); hasConfig = true; } catch {}
      try { await fs.access(envPath); hasEnv = true; } catch {}

      if (hasConfig) {
        packages.push({ dir, type: "config" });
      } else if (hasEnv) {
        packages.push({ dir, type: "env.ts" });
      }
    }

    for (const entry of entries) {
      if (entry.isDirectory() && !ignoreDirs.has(entry.name)) {
        await walk(path.join(dir, entry.name));
      }
    }
  }

  await walk(rootDir);
  return packages;
}
