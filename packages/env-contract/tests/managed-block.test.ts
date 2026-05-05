import { describe, it, expect } from "vitest";
import { injectIntoContent, extractManagedContent, START_MARKER, END_MARKER } from "../src/utils/managed-block.js";

describe("managed-block utility", () => {
  it("should append block to the end if markers don't exist", () => {
    const existing = "SOME_VAR=value";
    const managed = "MANAGED_VAR=";
    const result = injectIntoContent(existing, managed);
    
    expect(result).toContain(existing);
    expect(result).toContain(START_MARKER);
    expect(result).toContain(managed);
    expect(result).toContain(END_MARKER);
    expect(result.endsWith(`${END_MARKER}\n`)).toBe(true);
  });

  it("should replace existing block between markers", () => {
    const existing = `
BEFORE=1
${START_MARKER}
OLD_VAR=
${END_MARKER}
AFTER=1
`;
    const managed = "NEW_VAR=";
    const result = injectIntoContent(existing, managed);
    
    expect(result).toContain("BEFORE=1");
    expect(result).toContain("AFTER=1");
    expect(result).toContain("NEW_VAR=");
    expect(result).not.toContain("OLD_VAR=");
  });

  it("should extract managed content", () => {
    const content = `
${START_MARKER}
MANAGED_KEY=
${END_MARKER}
`;
    const extracted = extractManagedContent(content);
    expect(extracted).toContain("MANAGED_KEY=");
  });

  it("should return null if markers are missing", () => {
    expect(extractManagedContent("no markers here")).toBe(null);
  });
});
