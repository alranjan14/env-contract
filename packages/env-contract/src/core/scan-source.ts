import fs from "node:fs/promises";
import path from "node:path";
import oxc from "oxc-parser";

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
      regStr += `(?:${choices.map(choice => globToRegex(choice || "").source.replace(/^\^|\$$/g, "")).join("|")})`;
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

function pathMatches(relPath: string, patterns: string[]): boolean {
  const normalizedPath = relPath.replace(/\\/g, "/");
  return patterns.some(pattern => {
    const regex = globToRegex(pattern);
    return regex.test(normalizedPath);
  });
}

export async function scanSource(
  rootDir: string,
  options: {
    include?: string[];
    exclude?: string[];
    cwd?: string;
  } = {}
): Promise<ScanReport> {
  const report: ScanReport = { references: [], dynamic: [], warnings: [] };
  const baseCwd = options.cwd || rootDir;

  const defaultIncludes = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs"];
  const defaultExcludes = ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/.next/**", "**/.nuxt/**", "**/coverage/**", "**/build/**"];
  const pruneDirs = ["node_modules", "dist", ".git", ".next", ".nuxt", "coverage", "build"];

  const includes = options.include && options.include.length > 0 ? options.include : defaultIncludes;
  const excludes = options.exclude && options.exclude.length > 0 ? options.exclude : defaultExcludes;

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
        if (pathMatches(relPath, excludes)) {
          continue;
        }
        await walkDir(fullPath);
      } else {
        // Must match include patterns
        if (pathMatches(relPath, includes)) {
          // Must not match exclude patterns
          if (!pathMatches(relPath, excludes)) {
            await scanFile(fullPath, baseCwd, report);
          }
        }
      }
    }
  }

  await walkDir(rootDir);
  return report;
}

async function scanFile(filePath: string, baseCwd: string, report: ScanReport) {
  const relPath = path.relative(baseCwd, filePath);
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

    const program = JSON.parse(result.program);
    
    // To get line/col, we need a simple line offset map
    const lineStarts: number[] = [0];
    for (let i = 0; i < code.length; i++) {
      if (code[i] === "\n") lineStarts.push(i + 1);
    }

    walkAst(program, (node: any) => {
      if (!node) return;

      // Object.keys(process.env) / Object.values(process.env) / Object.entries(process.env)
      if (node.type === "CallExpression") {
        const callee = node.callee;
        if (
          callee.type === "StaticMemberExpression" &&
          callee.object.type === "Identifier" &&
          callee.object.name === "Object" &&
          callee.property.type === "Identifier" &&
          ["keys", "values", "entries"].includes(callee.property.name)
        ) {
          const firstArg = node.arguments[0];
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
        if (isProcessEnv(obj)) {
          const { line, column } = getPosition(node.start, lineStarts);
          report.references.push({
            key: node.property.name,
            file: relPath,
            line,
            column,
            kind: "process.env",
          });
          return;
        }

        if (isImportMetaEnv(obj)) {
          const { line, column } = getPosition(node.start, lineStarts);
          report.references.push({
            key: node.property.name,
            file: relPath,
            line,
            column,
            kind: "import.meta.env",
          });
          return;
        }
      }

      // 2. process.env["FOO"] / process.env?.[ "FOO" ]
      if (node.type === "ComputedMemberExpression") {
        const obj = node.object;
        if (isProcessEnv(obj) || isImportMetaEnv(obj)) {
          const { line, column } = getPosition(node.start, lineStarts);
          
          if (node.expression.type === "StringLiteral") {
            report.references.push({
              key: node.expression.value,
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
        if (node.init && (isProcessEnv(node.init) || isImportMetaEnv(node.init))) {
          if (node.id.type === "ObjectPattern") {
            const { line, column } = getPosition(node.start, lineStarts);
            for (const prop of node.id.properties) {
              if (prop.type === "BindingProperty" && prop.key.type === "Identifier") {
                report.references.push({
                  key: prop.key.name,
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

  } catch (error: any) {
    report.warnings.push({
      file: relPath,
      message: error.message || String(error),
    });
  }
}

// Helpers
function getPosition(offset: number, lineStarts: number[]) {
  let line = 1;
  let col = offset;
  for (let i = 0; i < lineStarts.length; i++) {
    const start = lineStarts[i]!;
    if (offset < start) break;
    line = i + 1;
    col = offset - start;
  }
  return { line, column: col + 1 };
}

function isProcessEnv(node: any): boolean {
  if (!node) return false;
  
  // If wrapped in optional chaining expression
  if (node.type === "ChainExpression") {
    return isProcessEnv(node.expression);
  }

  if (node.type !== "StaticMemberExpression") return false;
  return (
    node.object.type === "Identifier" &&
    node.object.name === "process" &&
    node.property.type === "Identifier" &&
    node.property.name === "env"
  );
}

function isImportMetaEnv(node: any): boolean {
  if (!node) return false;
  
  // If wrapped in optional chaining expression
  if (node.type === "ChainExpression") {
    return isImportMetaEnv(node.expression);
  }

  if (node.type !== "StaticMemberExpression") return false;
  
  const obj = node.object;
  if (obj.type !== "MetaProperty") return false;
  if (obj.meta.name !== "import" || obj.property.name !== "meta") return false;

  return node.property.type === "Identifier" && node.property.name === "env";
}

function walkAst(node: any, visitor: (n: any) => void) {
  if (!node || typeof node !== "object") return;

  // Visit current node
  if (node.type) {
    visitor(node);
  }

  // Walk children
  for (const key of Object.keys(node)) {
    // Avoid circular refs or walking loc/span objects if they exist
    if (key === "loc" || key === "span") continue;
    
    const child = node[key];
    if (Array.isArray(child)) {
      for (const c of child) {
        walkAst(c, visitor);
      }
    } else if (child && typeof child === "object") {
      walkAst(child, visitor);
    }
  }
}
