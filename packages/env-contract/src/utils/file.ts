import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export async function writeAtomically(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  const tempPath = path.join(dir, `.tmp-${crypto.randomUUID()}`);

  try {
    await fs.writeFile(tempPath, content, "utf-8");
    await fs.rename(tempPath, filePath);
  } catch (error) {
    // Best-effort cleanup so a failed write/rename doesn't leave a stray temp file.
    try {
      await fs.rm(tempPath, { force: true });
    } catch {
      // ignore cleanup failure — surface the original error
    }
    throw error;
  }
}

export async function findSchemaFile(cwd: string): Promise<string> {
  const candidates = [
    path.join(cwd, "src/env.ts"),
    path.join(cwd, "src/env/index.ts"),
    path.join(cwd, "env.ts"),
  ];

  for (const c of candidates) {
    try {
      await fs.access(c);
      return c;
    } catch {
      // ignore
    }
  }

  // Fallback default
  return path.join(cwd, "src/env.ts");
}
