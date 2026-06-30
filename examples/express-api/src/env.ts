import { z } from "zod";

// A plain Zod schema — env-contract auto-detects `src/env.ts` and treats this as
// the single source of truth for which environment variables exist.
export const env = z.object({
  DATABASE_URL: z.string().url().describe("Postgres connection string"),
  JWT_SECRET: z.string().min(32).describe("Secret used to sign JWTs"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info").describe("Pino log level"),
  PORT: z.coerce.number().default(3000).describe("HTTP port the server listens on"),
});
