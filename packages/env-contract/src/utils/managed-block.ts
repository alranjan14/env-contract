export const START_MARKER = "# >>> env-contract:start (do not edit this block manually)";
export const END_MARKER = "# <<< env-contract:end";

export function injectIntoContent(existingContent: string, newManagedContent: string): string {
  const startIdx = existingContent.indexOf(START_MARKER);
  const endIdx = existingContent.indexOf(END_MARKER);

  const block = `${START_MARKER}\n# Generated from schema. Run \`env-contract sync\` to update.\n\n${newManagedContent}\n${END_MARKER}`;

  if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
    // Replace existing block
    return (
      existingContent.substring(0, startIdx) +
      block +
      existingContent.substring(endIdx + END_MARKER.length)
    );
  }

  // Append to the end
  const needsNewline = existingContent.length > 0 && !existingContent.endsWith("\n");
  return existingContent + (needsNewline ? "\n\n" : "\n") + block + "\n";
}

export function extractManagedContent(content: string): string | null {
  const startIdx = content.indexOf(START_MARKER);
  const endIdx = content.indexOf(END_MARKER);

  if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
    return null;
  }

  return content.substring(startIdx + START_MARKER.length, endIdx).trim();
}
