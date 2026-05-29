import { describe, it, expect } from "vitest";
import { generateExample } from "../src/core/generate-example.js";
import { injectIntoContent } from "../src/utils/managed-block.js";
import type { Schema } from "../src/loaders/types.js";

describe(".env.example Generation and Formatting", () => {
  describe("generateExample", () => {
    it("should sort keys alphabetically within server and client groups, with server group first", () => {
      const mockSchema: Schema = {
        entries: [
          { key: "C_CLIENT", type: "string", optional: false, scope: "client" },
          { key: "A_SERVER", type: "string", optional: false, scope: "server" },
          { key: "A_CLIENT", type: "string", optional: false, scope: "client" },
          { key: "B_SERVER", type: "string", optional: false, scope: "server" },
        ],
      };

      const result = generateExample(mockSchema);
      const lines = result.split("\n");

      // Find indices of keys in output
      const idxAServer = lines.indexOf("A_SERVER=");
      const idxBServer = lines.indexOf("B_SERVER=");
      const idxAClient = lines.indexOf("A_CLIENT=");
      const idxCClient = lines.indexOf("C_CLIENT=");

      expect(idxAServer).toBeGreaterThan(-1);
      expect(idxBServer).toBeGreaterThan(idxAServer);
      expect(idxAClient).toBeGreaterThan(idxBServer);
      expect(idxCClient).toBeGreaterThan(idxAClient);
    });

    it("should classify unrecognized/unspecified scopes as server scope", () => {
      const mockSchema: Schema = {
        entries: [
          { key: "CLIENT_VAR", type: "string", optional: false, scope: "client" },
          // @ts-expect-error: scope is deliberately set to an invalid value for fallback testing
          { key: "UNKNOWN_VAR", type: "string", optional: false, scope: "unknown" },
          { key: "SERVER_VAR", type: "string", optional: false, scope: "server" },
        ],
      };

      const result = generateExample(mockSchema);
      const lines = result.split("\n");

      const idxServer = lines.indexOf("SERVER_VAR=");
      const idxUnknown = lines.indexOf("UNKNOWN_VAR=");
      const idxClient = lines.indexOf("CLIENT_VAR=");

      // Both SERVER_VAR and UNKNOWN_VAR should be in server block (sorted alphabetically)
      expect(idxServer).toBeGreaterThan(-1);
      expect(idxUnknown).toBeGreaterThan(-1);
      
      // Sorted alphabetically: SERVER_VAR then UNKNOWN_VAR
      expect(idxUnknown).toBeGreaterThan(idxServer);

      // Client block should follow server block
      expect(idxClient).toBeGreaterThan(idxUnknown);
    });

    it("should format comments strictly using description if present, else type name", () => {
      const mockSchema: Schema = {
        entries: [
          { key: "WITH_DESC", type: "string", optional: false, scope: "server", description: "This is a description" },
          { key: "WITHOUT_DESC", type: "url", optional: false, scope: "server" },
        ],
      };

      const result = generateExample(mockSchema);
      expect(result).toContain("# This is a description\nWITH_DESC=");
      expect(result).toContain("# url\nWITHOUT_DESC=");
      expect(result).not.toContain("Type: url");
    });

    it("should format default values correctly in comments using JSON.stringify", () => {
      const mockSchema: Schema = {
        entries: [
          { key: "PORT", type: "number", optional: true, scope: "server", description: "HTTP Port", default: 3000 },
          { key: "HOST", type: "string", optional: true, scope: "server", description: "Host string", default: "localhost" },
          { key: "SECURE", type: "boolean", optional: true, scope: "server", description: "Is SSL enabled", default: true },
        ],
      };

      const result = generateExample(mockSchema);
      expect(result).toContain("# HTTP Port (default: 3000) — Optional\nPORT=");
      expect(result).toContain('# Host string (default: "localhost") — Optional\nHOST=');
      expect(result).toContain("# Is SSL enabled (default: true) — Optional\nSECURE=");
    });

    it("should format optional keys with the em-dash spacer and tag", () => {
      const mockSchema: Schema = {
        entries: [
          { key: "OPTIONAL_VAR", type: "string", optional: true, scope: "server", description: "Optional variable" },
          { key: "REQUIRED_VAR", type: "string", optional: false, scope: "server", description: "Required variable" },
        ],
      };

      const result = generateExample(mockSchema);
      expect(result).toContain("# Optional variable — Optional\nOPTIONAL_VAR=");
      expect(result).toContain("# Required variable\nREQUIRED_VAR=");
    });

    it("should never write default values on the right-hand side of assignments", () => {
      const mockSchema: Schema = {
        entries: [
          { key: "PORT", type: "number", optional: true, scope: "server", default: 3000 },
        ],
      };

      const result = generateExample(mockSchema);
      expect(result).toContain("PORT=");
      expect(result).not.toContain("PORT=3000");
    });
  });

  describe("injectIntoContent relative schema path", () => {
    const startMarker = "# >>> env-contract:start (do not edit this block manually)";
    const endMarker = "# <<< env-contract:end";

    it("should inject relative schema path in headers when provided", () => {
      const existing = ``;
      const managed = `VAR=`;
      const result = injectIntoContent(existing, managed, "src/env.ts");

      expect(result).toContain(startMarker);
      expect(result).toContain("# Generated from src/env.ts. Run `env-contract sync` to update.");
      expect(result).toContain(endMarker);
    });

    it("should use fallback label in header when schemaPath is not provided", () => {
      const existing = ``;
      const managed = `VAR=`;
      const result = injectIntoContent(existing, managed);

      expect(result).toContain(startMarker);
      expect(result).toContain("# Generated from schema. Run `env-contract sync` to update.");
      expect(result).toContain(endMarker);
    });
  });
});
