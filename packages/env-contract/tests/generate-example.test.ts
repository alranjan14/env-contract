import { describe, it, expect } from "vitest";
import { generateExample } from "../src/core/generate-example.js";
import type { Schema } from "../src/loaders/types.js";

describe("generate-example", () => {
  it("should format schema entries correctly", () => {
    const schema: Schema = {
      entries: [
        {
          key: "DB_URL",
          type: "url",
          optional: false,
          description: "Database connection",
          scope: "server",
        },
        {
          key: "PORT",
          type: "number",
          optional: true,
          default: 3000,
          scope: "server",
        },
      ],
    };

    const result = generateExample(schema);
    
    expect(result).toContain("# Database connection");
    expect(result).toContain("DB_URL=");
    expect(result).toContain("# number (default: 3000) — Optional");
    expect(result).toContain("PORT=");
  });

  it("should group by scope", () => {
    const schema: Schema = {
      entries: [
        { key: "SERVER_VAR", type: "string", optional: false, scope: "server" },
        { key: "CLIENT_VAR", type: "string", optional: false, scope: "client" },
      ],
    };

    const result = generateExample(schema);
    const lines = result.split("\n");
    
    const serverIdx = lines.findIndex(l => l.includes("SERVER_VAR"));
    const clientIdx = lines.findIndex(l => l.includes("CLIENT_VAR"));
    
    expect(serverIdx).toBeLessThan(clientIdx);
  });
});
