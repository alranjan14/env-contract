import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSchema } from "../src/core/load-schema.js";

// Verifies t3-env support against the REAL `@t3-oss/env-nextjs` (a devDependency),
// not a mocked shape — the gap that motivated this loader rewrite.
const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, "fixtures/t3-env-real/src/env.ts");

describe("t3-env (real @t3-oss/env-nextjs)", () => {
  let previous: string | undefined;
  beforeAll(() => {
    previous = process.env.SKIP_ENV_VALIDATION;
    // Without this, `createEnv` validates at import time and throws on the
    // missing vars — exactly what the README's CI recipe injects.
    process.env.SKIP_ENV_VALIDATION = "1";
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.SKIP_ENV_VALIDATION;
    else process.env.SKIP_ENV_VALIDATION = previous;
  });

  it("introspects the exported { server, client } records with scope + metadata", async () => {
    const schema = await loadSchema(fixture);
    const byKey = Object.fromEntries(schema.entries.map((e) => [e.key, e]));

    expect(Object.keys(byKey).sort()).toEqual([
      "AUTH_SECRET",
      "DATABASE_URL",
      "NEXT_PUBLIC_API_URL",
    ]);

    expect(byKey.DATABASE_URL?.scope).toBe("server");
    expect(byKey.DATABASE_URL?.type).toBe("url");
    expect(byKey.DATABASE_URL?.description).toBe("Postgres connection string");

    expect(byKey.AUTH_SECRET?.scope).toBe("server");

    expect(byKey.NEXT_PUBLIC_API_URL?.scope).toBe("client");
    expect(byKey.NEXT_PUBLIC_API_URL?.type).toBe("url");
  });
});
