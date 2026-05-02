import type { Schema, SchemaEntry } from "../loaders/types.js";

export function generateExample(schema: Schema): string {
  const serverEntries = schema.entries.filter((e) => e.scope === "server");
  const clientEntries = schema.entries.filter((e) => e.scope === "client");

  const lines: string[] = [];

  if (serverEntries.length > 0) {
    lines.push(...formatEntries(serverEntries));
  }

  if (clientEntries.length > 0) {
    if (serverEntries.length > 0) lines.push(""); // Spacing
    lines.push(...formatEntries(clientEntries));
  }

  return lines.join("\n");
}

function formatEntries(entries: SchemaEntry[]): string[] {
  const lines: string[] = [];
  
  for (const entry of entries) {
    if (lines.length > 0) lines.push(""); // Blank line between entries
    
    // Description
    if (entry.description) {
      lines.push(`# ${entry.description}`);
    } else {
      lines.push(`# Type: ${entry.type}`);
    }

    // Optional / Default metadata
    const meta: string[] = [];
    if (entry.optional) meta.push("Optional");
    if (entry.default !== undefined) meta.push(`default: ${JSON.stringify(entry.default)}`);
    
    if (meta.length > 0) {
      lines.push(`# (${meta.join(", ")})`);
    }

    // Key=
    lines.push(`${entry.key}=`);
  }

  return lines;
}
