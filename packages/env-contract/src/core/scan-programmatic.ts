import { scanSource } from "./scan-source.js";
import type { Reference, DynamicReference } from "./scan-source.js";

export async function scan(options: {
  root: string;
  patterns?: string[];
  exclude?: string[];
  cwd?: string;
}): Promise<{
  references: Reference[];
  dynamic: DynamicReference[];
  warnings: Array<{ file: string; message: string }>;
  grouped: Record<string, Reference[]>;
}> {
  const scanOptions: { include?: string[]; exclude?: string[]; cwd?: string } = {};
  if (options.patterns !== undefined) scanOptions.include = options.patterns;
  if (options.exclude !== undefined) scanOptions.exclude = options.exclude;
  if (options.cwd !== undefined) scanOptions.cwd = options.cwd;

  const report = await scanSource(options.root, scanOptions);

  const grouped: Record<string, Reference[]> = {};
  for (const ref of report.references) {
    let group = grouped[ref.key];
    if (!group) {
      group = [];
      grouped[ref.key] = group;
    }
    group.push(ref);
  }

  return {
    references: report.references,
    dynamic: report.dynamic,
    warnings: report.warnings,
    grouped,
  };
}
