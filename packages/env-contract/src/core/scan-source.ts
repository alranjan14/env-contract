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
}

export async function scanSource(
  rootDir: string,
  includePatterns: string[] = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]
): Promise<ScanReport> {
  const report: ScanReport = { references: [], dynamic: [] };

  async function walkDir(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== "dist" && entry.name !== ".git") {
          await walkDir(fullPath);
        }
      } else {
        if (includePatterns.some((ext) => fullPath.endsWith(ext))) {
          await scanFile(fullPath, rootDir, report);
        }
      }
    }
  }

  await walkDir(rootDir);
  return report;
}

async function scanFile(filePath: string, rootDir: string, report: ScanReport) {
  try {
    const code = await fs.readFile(filePath, "utf-8");
    const result = oxc.parseSync(code, { sourceFilename: filePath });
    const program = JSON.parse(result.program);
    
    // To get line/col, we need a simple line offset map
    const lineStarts: number[] = [0];
    for (let i = 0; i < code.length; i++) {
      if (code[i] === "\n") lineStarts.push(i + 1);
    }

    function getPosition(offset: number) {
      let line = 1;
      let col = offset;
      for (let i = 0; i < lineStarts.length; i++) {
        if (offset < lineStarts[i]) break;
        line = i + 1;
        col = offset - lineStarts[i];
      }
      return { line, column: col + 1 };
    }

    const relPath = path.relative(rootDir, filePath);

    walkAst(program, (node: any) => {
      if (!node) return;

      // 1. process.env.FOO
      if (node.type === "StaticMemberExpression") {
        const obj = node.object;
        if (isProcessEnv(obj)) {
          const { line, column } = getPosition(node.start);
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
          const { line, column } = getPosition(node.start);
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

      // 2. process.env["FOO"]
      if (node.type === "ComputedMemberExpression") {
        const obj = node.object;
        if (isProcessEnv(obj) || isImportMetaEnv(obj)) {
          const { line, column } = getPosition(node.start);
          
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
            const { line, column } = getPosition(node.start);
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

  } catch (error) {
    console.warn(`[env-contract] Failed to parse ${filePath}:`, error);
  }
}

// Helpers
function isProcessEnv(node: any): boolean {
  if (!node || node.type !== "StaticMemberExpression") return false;
  return (
    node.object.type === "Identifier" &&
    node.object.name === "process" &&
    node.property.type === "Identifier" &&
    node.property.name === "env"
  );
}

function isImportMetaEnv(node: any): boolean {
  if (!node || node.type !== "StaticMemberExpression") return false;
  
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
