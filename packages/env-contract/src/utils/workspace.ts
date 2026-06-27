import fs from "node:fs/promises";
import path from "node:path";
import { errorCode } from "./errors.js";

export interface WorkspacePackage {
  dir: string;
  type: "config" | "env.ts";
}

// Simple YAML packages parser without external dependencies
export function parsePnpmWorkspaceYaml(content: string): string[] {
  const globs: string[] = [];
  const lines = content.split(/\r?\n/);
  let insidePackages = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("packages:")) {
      insidePackages = true;
      // Inline parser check, e.g. packages: ["packages/*"]
      const inlineMatch = trimmed.match(/packages:\s*\[(.*?)\]/);
      if (inlineMatch && inlineMatch[1]) {
        const parts = inlineMatch[1].split(",");
        for (const p of parts) {
          const clean = p.replace(/['"[\]\s]/g, "");
          if (clean) globs.push(clean);
        }
      }
      continue;
    }

    if (insidePackages) {
      if (/^[a-zA-Z_]+:/.test(line) && !line.startsWith(" ")) {
        insidePackages = false;
        continue;
      }

      const itemMatch = trimmed.match(/^-\s*['"]?(.*?)['"]?$/);
      if (itemMatch && itemMatch[1]) {
        globs.push(itemMatch[1].trim());
      }
    }
  }

  return globs;
}

// Zero-dependency glob/path resolver for workspace directories
export async function resolveWorkspaceGlobs(rootDir: string, globs: string[]): Promise<string[]> {
  const resolvedDirs = new Set<string>();

  for (const glob of globs) {
    const cleanGlob = glob.trim().replace(/\\/g, "/");
    if (!cleanGlob) continue;

    if (cleanGlob.endsWith("/*")) {
      const parentRel = cleanGlob.slice(0, -2);
      const parentAbs = path.resolve(rootDir, parentRel);
      try {
        const stats = await fs.stat(parentAbs);
        if (stats.isDirectory()) {
          const entries = await fs.readdir(parentAbs, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const dirAbs = path.join(parentAbs, entry.name);
              try {
                await fs.access(path.join(dirAbs, "package.json"));
                resolvedDirs.add(dirAbs);
              } catch {
                // Not a package
              }
            }
          }
        }
      } catch {
        // Parent folder doesn't exist
      }
    } else if (cleanGlob.endsWith("/**")) {
      const parentRel = cleanGlob.slice(0, -3);
      const parentAbs = path.resolve(rootDir, parentRel);

      const walk = async (dir: string) => {
        let entries;
        try {
          entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }

        for (const entry of entries) {
          if (
            entry.isDirectory() &&
            entry.name !== "node_modules" &&
            entry.name !== "dist" &&
            entry.name !== ".git"
          ) {
            const childAbs = path.join(dir, entry.name);
            try {
              await fs.access(path.join(childAbs, "package.json"));
              resolvedDirs.add(childAbs);
            } catch {
              // Not a package, walk deeper
            }
            await walk(childAbs);
          }
        }
      };
      await walk(parentAbs);
    } else {
      const dirAbs = path.resolve(rootDir, cleanGlob);
      try {
        await fs.access(path.join(dirAbs, "package.json"));
        resolvedDirs.add(dirAbs);
      } catch {
        // Invalid package or doesn't exist
      }
    }
  }

  return Array.from(resolvedDirs);
}

// Classify if a package directory is env-contract enabled
export async function checkIfPackageIsContractEnabled(
  dir: string,
): Promise<WorkspacePackage | null> {
  const exts = [".ts", ".js", ".mjs", ".cjs"];
  let hasConfig = false;

  for (const ext of exts) {
    try {
      await fs.access(path.join(dir, `env-contract.config${ext}`));
      hasConfig = true;
      break;
    } catch {
      // ignore
    }
  }

  if (!hasConfig) {
    try {
      const pkgContent = await fs.readFile(path.join(dir, "package.json"), "utf-8");
      const pkg = JSON.parse(pkgContent) as { "env-contract"?: unknown };
      if (pkg["env-contract"]) {
        hasConfig = true;
      }
    } catch {
      // ignore
    }
  }

  if (hasConfig) {
    return { dir, type: "config" };
  }

  // Check for candidate schema files
  const candidateFiles = [
    path.join(dir, "src/env.ts"),
    path.join(dir, "src/env/index.ts"),
    path.join(dir, "env.ts"),
  ];

  for (const c of candidateFiles) {
    try {
      await fs.access(c);
      return { dir, type: "env.ts" };
    } catch {
      // ignore
    }
  }

  return null;
}

export async function findWorkspacePackages(rootDir: string): Promise<WorkspacePackage[]> {
  let packageDirs: string[] = [];

  // 1. Try pnpm-workspace.yaml
  try {
    const yamlContent = await fs.readFile(path.join(rootDir, "pnpm-workspace.yaml"), "utf-8");
    const globs = parsePnpmWorkspaceYaml(yamlContent);
    if (globs.length > 0) {
      packageDirs = await resolveWorkspaceGlobs(rootDir, globs);
    }
  } catch {
    // pnpm-workspace.yaml not found or unreadable
  }

  // 2. Try package.json workspaces if pnpm wasn't resolved
  if (packageDirs.length === 0) {
    try {
      const pkgContent = await fs.readFile(path.join(rootDir, "package.json"), "utf-8");
      const pkg = JSON.parse(pkgContent) as {
        workspaces?: string[] | { packages?: string[] };
      };
      if (pkg.workspaces) {
        let globs: string[] = [];
        if (Array.isArray(pkg.workspaces)) {
          globs = pkg.workspaces;
        } else if (pkg.workspaces.packages && Array.isArray(pkg.workspaces.packages)) {
          globs = pkg.workspaces.packages;
        }
        if (globs.length > 0) {
          packageDirs = await resolveWorkspaceGlobs(rootDir, globs);
        }
      }
    } catch {
      // package.json workspaces not found or unreadable
    }
  }

  // If we found workspace directories, filter them by contract enabled
  if (packageDirs.length > 0) {
    const packages: WorkspacePackage[] = [];
    for (const dir of packageDirs) {
      const isEnabled = await checkIfPackageIsContractEnabled(dir);
      if (isEnabled) {
        packages.push(isEnabled);
      }
    }
    return packages;
  }

  // 3. Fallback: recursive scan
  const packages: WorkspacePackage[] = [];
  const ignoreDirs = new Set(["node_modules", "dist", ".git", ".next", "build", "coverage"]);

  async function walk(dir: string) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (e: unknown) {
      const code = errorCode(e);
      if (code === "ENOENT" || code === "EACCES") return;
      throw e;
    }

    let isPackage = false;
    for (const entry of entries) {
      if (entry.name === "package.json") isPackage = true;
    }

    if (isPackage) {
      const isEnabled = await checkIfPackageIsContractEnabled(dir);
      if (isEnabled) {
        packages.push(isEnabled);
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
