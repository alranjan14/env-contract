import { z } from "zod";

// A plain Zod schema for a Next.js app. `NEXT_PUBLIC_*` keys are the client-side
// vars Next inlines into the browser bundle; the rest stay server-only.
//
// Prefer `@t3-oss/env-nextjs` for first-class client/server separation? It works
// the same way with env-contract — see the T3 recipe in
// ../../packages/env-contract/docs/recipes.md (§1, §2).
export const env = z.object({
  AUTH_SECRET: z.string().min(32).describe("NextAuth.js session secret"),
  DATABASE_URL: z.string().url().describe("Postgres connection string"),
  NEXT_PUBLIC_API_URL: z.string().url().describe("Public API base URL (exposed to the browser)"),
});
