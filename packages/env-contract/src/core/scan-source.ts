// oxc@0.31 serializes its AST to a JSON string, so we parse it and walk a typed
// structural view (AstNode) of the nodes we inspect. Removing the JSON round-trip
// would require upgrading oxc-parser, whose node names change across versions
// (tracked in TODO.md); the typing here makes the walk fully type-safe regardless.
import fs from "node:fs/promises";
import path from "node:path";
import oxc from "oxc-parser";
import { toError } from "../utils/errors.js";

export interface Reference {
  key: string;
  file: string;
  line: number;
  column: number;
  kind: "process.env" | "import.meta.env" | "destructure";
}

export interface DynamicReference {
  file: string;
  line: number;
  snippet: string;
}

export interface ScanReport {
  references: Reference[];
  dynamic: DynamicReference[];
  warnings: Array<{ file: string; message: string }>;
}

/**
 * Structural view of the (oxc/ESTree-ish) AST nodes the scanner reads. Because
 * oxc hands us the AST as JSON, this models only the fields we inspect; any
 * field not relevant to env detection is simply absent.
 */
interface AstNode {
  type: string;
  start: number;
  end: number;
  name?: string;
  value?: unknown;
  callee?: AstNode;
  object?: AstNode;
  property?: AstNode;
  expression?: AstNode;
  arguments?: AstNode[];
  id?: AstNode;
  init?: AstNode | null;
  properties?: AstNode[];
  key?: AstNode;
  meta?: AstNode;
}

export function globToRegex(pattern: string): RegExp {
  let normalized = pattern.replace(/\\/g, "/");

  if (normalized.startsWith("**/")) {
    const restRegex = globToRegex(normalized.substring(3)).source.replace(/^\^|\$$/g, "");
    return new RegExp(`^(?:^|.*/)${restRegex}$`);
  }

  // Replace /**/ with a placeholder
  normalized = normalized.replace(/\/\*\*\//g, "/__GLOBSTAR_DIR__/");

  let regStr = "";
  let i = 0;
  while (i < normalized.length) {
    if (normalized.substring(i).startsWith("__GLOBSTAR_DIR__")) {
      regStr += "(?:.*/)?";
      i += "__GLOBSTAR_DIR__".length;
      continue;
    }

    const c = normalized[i];
    if (c === undefined) break;
    if (c === "*") {
      if (normalized[i + 1] === "*") {
        regStr += ".*";
        i += 2;
      } else {
        regStr += "[^/]*";
        i++;
      }
    } else if (c === "?") {
      regStr += "[^/]";
      i++;
    } else if (c === "{") {
      let j = i + 1;
      let depth = 1;
      while (j < normalized.length && depth > 0) {
        if (normalized[j] === "{") depth++;
        if (normalized[j] === "}") depth--;
        j++;
      }
      const choices = normalized.substring(i + 1, j - 1).split(",");
      regStr += `(?:${choices.map((choice) => globToRegex(choice || "").source.replace(/^\^|\$$/g, "")).join("|")})`;
      i = j;
    } else if (/[.+^$()|[\]\\]/.test(c)) {
      regStr += "\\" + c;
      i++;
    } else {
      regStr += c;
      i++;
    }
  }

  return new RegExp(`^${regStr}$`);
}

function pathMatches(relPath: string, regexes: RegExp[]): boolean {
  const normalizedPath = relPath.replace(/\\/g, "/");
  return regexes.some((regex) => regex.test(normalizedPath));
}

export async function scanSource(
  rootDir: string,
  options: {
    include?: string[];
    exclude?: string[];
    cwd?: string;
  } = {},
): Promise<ScanReport> {
  const report: ScanReport = { references: [], dynamic: [], warnings: [] };
  const baseCwd = options.cwd || rootDir;

  const defaultIncludes = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs"];
  const defaultExcludes = [
    "**/node_modules/**",
    "**/dist/**",
    "**/.git/**",
    "**/.next/**",
    "**/.nuxt/**",
    "**/coverage/**",
    "**/build/**",
  ];
  const pruneDirs = ["node_modules", "dist", ".git", ".next", ".nuxt", "coverage", "build"];

  const includes =
    options.include && options.include.length > 0 ? options.include : defaultIncludes;
  const excludes =
    options.exclude && options.exclude.length > 0 ? options.exclude : defaultExcludes;

  // Compile glob patterns once up front rather than recompiling them for every
  // path visited during the walk.
  const includeRegexes = includes.map(globToRegex);
  const excludeRegexes = excludes.map(globToRegex);

  const filesToScan: string[] = [];

  async function walkDir(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(baseCwd, fullPath);

      if (entry.isDirectory()) {
        // Prune default ignored directories early for performance
        if (pruneDirs.includes(entry.name)) {
          continue;
        }
        // Also prune if directory matches any exclude pattern
        if (pathMatches(relPath, excludeRegexes)) {
          continue;
        }
        await walkDir(fullPath);
      } else {
        // Must match include patterns
        if (pathMatches(relPath, includeRegexes)) {
          // Must not match exclude patterns
          if (!pathMatches(relPath, excludeRegexes)) {
            filesToScan.push(fullPath);
          }
        }
      }
    }
  }

  await walkDir(rootDir);

  // Scan files with bounded concurrency. oxc's parseSync is synchronous, so the
  // CPU-bound parsing still serializes, but file reads overlap. Results are
  // merged in walk order, so output is identical to a sequential scan.
  const CONCURRENCY = 16;
  for (let i = 0; i < filesToScan.length; i += CONCURRENCY) {
    const batch = filesToScan.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((file) => scanFile(file, baseCwd)));
    for (const result of results) {
      report.references.push(...result.references);
      report.dynamic.push(...result.dynamic);
      report.warnings.push(...result.warnings);
    }
  }

  return report;
}

async function scanFile(filePath: string, baseCwd: string): Promise<ScanReport> {
  // Normalize to forward slashes so reported paths are consistent across OSes
  // (Windows path.relative yields backslashes).
  const relPath = path.relative(baseCwd, filePath).replace(/\\/g, "/");
  const report: ScanReport = { references: [], dynamic: [], warnings: [] };
  try {
    const code = await fs.readFile(filePath, "utf-8");
    const result = oxc.parseSync(code, { sourceFilename: filePath });

    if (result.errors && result.errors.length > 0) {
      for (const err of result.errors) {
        report.warnings.push({
          file: relPath,
          message: err,
        });
      }
    }

    const program = JSON.parse(result.program) as AstNode;

    // To get line/col, we need a simple line offset map
    const lineStarts: number[] = [0];
    for (let i = 0; i < code.length; i++) {
      if (code[i] === "\n") lineStarts.push(i + 1);
    }

    walkAst(program, (node) => {
      // Object.keys(process.env) / Object.values(process.env) / Object.entries(process.env)
      if (node.type === "CallExpression") {
        const callee = node.callee;
        const calleeObject = callee?.object;
        const calleeProperty = callee?.property;
        if (
          callee?.type === "StaticMemberExpression" &&
          calleeObject?.type === "Identifier" &&
          calleeObject.name === "Object" &&
          calleeProperty?.type === "Identifier" &&
          calleeProperty.name !== undefined &&
          ["keys", "values", "entries"].includes(calleeProperty.name)
        ) {
          const firstArg = node.arguments?.[0];
          if (firstArg && (isProcessEnv(firstArg) || isImportMetaEnv(firstArg))) {
            const { line } = getPosition(node.start, lineStarts);
            report.dynamic.push({
              file: relPath,
              line,
              snippet: code.substring(node.start, node.end),
            });
            return;
          }
        }
      }

      // 1. process.env.FOO / process.env?.FOO
      if (node.type === "StaticMemberExpression") {
        const obj = node.object;
        const key = node.property?.name;
        if (key !== undefined && isProcessEnv(obj)) {
          const { line, column } = getPosition(node.start, lineStarts);
          report.references.push({ key, file: relPath, line, column, kind: "process.env" });
          return;
        }
        if (key !== undefined && isImportMetaEnv(obj)) {
          const { line, column } = getPosition(node.start, lineStarts);
          report.references.push({ key, file: relPath, line, column, kind: "import.meta.env" });
          return;
        }
      }

      // 2. process.env["FOO"] / process.env?.[ "FOO" ]
      if (node.type === "ComputedMemberExpression") {
        const obj = node.object;
        if (isProcessEnv(obj) || isImportMetaEnv(obj)) {
          const { line, column } = getPosition(node.start, lineStarts);
          const expr = node.expression;

          if (expr?.type === "StringLiteral" && typeof expr.value === "string") {
            report.references.push({
              key: expr.value,
              file: relPath,
              line,
              column,
              kind: isProcessEnv(obj) ? "process.env" : "import.meta.env",
            });
          } else {
            // Dynamic access
            report.dynamic.push({
              file: relPath,
              line,
              snippet: code.substring(node.start, node.end),
            });
          }
          return;
        }
      }

      // 3. const { FOO } = process.env
      if (node.type === "VariableDeclarator") {
        const init = node.init;
        const id = node.id;
        if (init && (isProcessEnv(init) || isImportMetaEnv(init))) {
          if (id?.type === "ObjectPattern" && id.properties) {
            const { line, column } = getPosition(node.start, lineStarts);
            for (const prop of id.properties) {
              const propKey = prop.key;
              if (
                prop.type === "BindingProperty" &&
                propKey?.type === "Identifier" &&
                propKey.name !== undefined
              ) {
                report.references.push({
                  key: propKey.name,
                  file: relPath,
                  line,
                  column,
                  kind: "destructure",
                });
              }
            }
          }
        }
      }
    });
  } catch (error: unknown) {
    report.warnings.push({
      file: relPath,
      message: toError(error).message,
    });
  }

  return report;
}

// Helpers
function getPosition(offset: number, lineStarts: number[]): { line: number; column: number } {
  // Largest index whose line-start offset is <= `offset` (binary search).
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid]! <= offset) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return { line: lo + 1, column: offset - lineStarts[lo]! + 1 };
}

function isProcessEnv(node: AstNode | undefined | null): boolean {
  if (!node) return false;

  // If wrapped in an optional-chaining expression
  if (node.type === "ChainExpression") {
    return isProcessEnv(node.expression);
  }

  if (node.type !== "StaticMemberExpression") return false;
  const { object, property } = node;
  if (!object || !property) return false;
  return (
    object.type === "Identifier" &&
    object.name === "process" &&
    property.type === "Identifier" &&
    property.name === "env"
  );
}

function isImportMetaEnv(node: AstNode | undefined | null): boolean {
  if (!node) return false;

  // If wrapped in an optional-chaining expression
  if (node.type === "ChainExpression") {
    return isImportMetaEnv(node.expression);
  }

  if (node.type !== "StaticMemberExpression") return false;
  const { object, property } = node;
  if (!object || !property) return false;

  // `object` is `import.meta`: its `meta` is `import` and `property` is `meta`.
  if (object.type !== "MetaProperty") return false;
  if (object.meta?.name !== "import" || object.property?.name !== "meta") return false;

  return property.type === "Identifier" && property.name === "env";
}

function walkAst(node: unknown, visitor: (n: AstNode) => void): void {
  if (!node || typeof node !== "object") return;

  const record = node as Record<string, unknown>;

  // Anything carrying a string `type` is treated as an AST node.
  if (typeof record.type === "string") {
    visitor(node as AstNode);
  }

  // Walk children
  for (const key of Object.keys(record)) {
    // Avoid walking position/span metadata
    if (key === "loc" || key === "span") continue;

    const child = record[key];
    if (Array.isArray(child)) {
      for (const c of child) {
        walkAst(c, visitor);
      }
    } else if (child && typeof child === "object") {
      walkAst(child, visitor);
    }
  }
}
