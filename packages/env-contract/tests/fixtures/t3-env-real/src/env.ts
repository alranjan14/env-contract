import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// Export the schema *records* so env-contract can introspect them with full
// metadata. `createEnv`'s return value exposes only validated values (no
// schemas, no marker), so the records are the introspectable source of truth.
export const envSchema = {
  server: {
    DATABASE_URL: z.string().url().describe("Postgres connection string"),
    AUTH_SECRET: z.string().min(32).describe("Session secret"),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url().describe("Public API URL"),
  },
};

export const env = createEnv({
  ...envSchema,
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env,
  // Run env-contract with SKIP_ENV_VALIDATION=1 so this doesn't throw at import.
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
