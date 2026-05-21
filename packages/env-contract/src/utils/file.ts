import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export async function writeAtomically(filePath: string, content: string) {
  const dir = path.dirname(filePath);
  const tempPath = path.join(dir, `.tmp-${crypto.randomUUID()}`);
  
  await fs.writeFile(tempPath, content, "utf-8");
  await fs.rename(tempPath, filePath);
}
