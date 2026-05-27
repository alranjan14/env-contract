import { describe, it, expect } from "vitest";
import { extractManagedContent } from "../src/utils/managed-block.js";
import { parseEnvKeys } from "../src/core/diff.js";

describe("managed-block drift detection extraction and parsing", () => {
  it("should ignore manual content outside the managed block", () => {
    const fileContent = `
# Outside manual comment
SOME_MANUAL_KEY=foo
ANOTHER_MANUAL_KEY=bar

# >>> env-contract:start (do not edit this block manually)
# Generated from schema. Run \`env-contract sync\` to update.

# Postgres connection string
DATABASE_URL=
PORT=
# <<< env-contract:end

LATE_MANUAL_KEY=baz
`;

    const managedContent = extractManagedContent(fileContent);
    expect(managedContent).not.toBeNull();
    
    const parsedKeys = parseEnvKeys(managedContent!);
    expect(parsedKeys).toContain("DATABASE_URL");
    expect(parsedKeys).toContain("PORT");
    expect(parsedKeys).not.toContain("SOME_MANUAL_KEY");
    expect(parsedKeys).not.toContain("ANOTHER_MANUAL_KEY");
    expect(parsedKeys).not.toContain("LATE_MANUAL_KEY");
  });

  it("should handle absent markers by returning null managed content", () => {
    const fileContent = `
SOME_MANUAL_KEY=foo
ANOTHER_MANUAL_KEY=bar
`;
    const managedContent = extractManagedContent(fileContent);
    expect(managedContent).toBeNull();
  });

  it("should handle malformed markers (missing end marker) by returning null", () => {
    const fileContent = `
# >>> env-contract:start (do not edit this block manually)
DATABASE_URL=
`;
    const managedContent = extractManagedContent(fileContent);
    expect(managedContent).toBeNull();
  });

  it("should handle malformed markers (missing start marker) by returning null", () => {
    const fileContent = `
DATABASE_URL=
# <<< env-contract:end
`;
    const managedContent = extractManagedContent(fileContent);
    expect(managedContent).toBeNull();
  });

  it("should handle malformed markers (end before start) by returning null", () => {
    const fileContent = `
# <<< env-contract:end
# >>> env-contract:start (do not edit this block manually)
DATABASE_URL=
`;
    const managedContent = extractManagedContent(fileContent);
    expect(managedContent).toBeNull();
  });

  it("should ignore comments inside the managed block", () => {
    const managedBlockContent = `
# This is a comment
# (Optional)
DATABASE_URL=
# Another comment
PORT=3000
`;
    const parsedKeys = parseEnvKeys(managedBlockContent);
    expect(parsedKeys).toEqual(["DATABASE_URL", "PORT"]);
  });

  it("should correctly parse keys with or without values", () => {
    const managedBlockContent = `
DATABASE_URL=
PORT=3000
JWT_SECRET=super-secret-key-123
`;
    const parsedKeys = parseEnvKeys(managedBlockContent);
    expect(parsedKeys).toEqual(["DATABASE_URL", "PORT", "JWT_SECRET"]);
  });

  it("should allow duplicate keys to be parsed (allowing the caller to deduplicate)", () => {
    const managedBlockContent = `
DATABASE_URL=
DATABASE_URL=
PORT=
`;
    const parsedKeys = parseEnvKeys(managedBlockContent);
    expect(parsedKeys).toEqual(["DATABASE_URL", "DATABASE_URL", "PORT"]);
    
    // Deduplication test
    const uniqueKeys = Array.from(new Set(parsedKeys));
    expect(uniqueKeys).toEqual(["DATABASE_URL", "PORT"]);
  });
});
