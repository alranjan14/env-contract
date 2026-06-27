import type { Schema, SchemaEntry } from "../loaders/types.js";
import { START_MARKER, END_MARKER } from "../utils/managed-block.js";

export function generateExample(schema: Schema, options?: { managedBlock?: boolean }): string {
  const serverEntries = schema.entries.filter((e) => e.scope !== "client");
  const clientEntries = schema.entries.filter((e) => e.scope === "client");

  // Sort groups alphabetically by key
  serverEntries.sort((a, b) => a.key.localeCompare(b.key));
  clientEntries.sort((a, b) => a.key.localeCompare(b.key));

  const lines: string[] = [];

  if (serverEntries.length > 0) {
    lines.push(...formatEntries(serverEntries));
  }

  if (clientEntries.length > 0) {
    if (serverEntries.length > 0) lines.push(""); // Spacing
    lines.push(...formatEntries(clientEntries));
  }

  const rawContent = lines.join("\n");
  if (options?.managedBlock) {
    return `${START_MARKER}\n# Generated from schema. Run \`env-contract sync\` to update.\n\n${rawContent}\n${END_MARKER}`;
  }
  return rawContent;
}

function formatEntries(entries: SchemaEntry[]): string[] {
  const lines: string[] = [];

  for (const entry of entries) {
    if (lines.length > 0) lines.push(""); // Blank line between entries

    // Base description or fallback to type
    let comment = entry.description ? entry.description : entry.type;

    // Add default if present
    if (entry.default !== undefined) {
      comment += ` (default: ${JSON.stringify(entry.default)})`;
    }

    // Add optional if present
    if (entry.optional) {
      comment += " — Optional";
    }

    lines.push(`# ${comment}`);
    lines.push(`${entry.key}=`);
  }

  return lines;
}
