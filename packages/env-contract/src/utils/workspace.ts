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
      const exts = [".ts", ".js", ".mjs", ".cjs"];
      let hasConfig = false;
      let hasEnv = false;

      for (const ext of exts) {
        try {
          await fs.access(path.join(dir, `env-contract.config${ext}`));
          hasConfig = true;
          break;
        } catch {
          // Intentional ignore: Config file with this extension not found, try next
        }
      }

      if (!hasConfig) {
        try {
          const pkgContent = await fs.readFile(path.join(dir, "package.json"), "utf-8");
          const pkg = JSON.parse(pkgContent);
          if (pkg["env-contract"]) {
            hasConfig = true;
          }
        } catch {
          // Intentional ignore: package.json is missing, unreadable, or invalid JSON
        }
      }

      try {
        await fs.access(path.join(dir, "src/env.ts"));
        hasEnv = true;
      } catch {
        // Intentional ignore: src/env.ts not found
      }

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
