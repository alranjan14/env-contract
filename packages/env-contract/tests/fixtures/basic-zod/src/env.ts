import { z } from "zod";

export const envSchema = z.object({
  PORT: z.string().default("3000"),
  DATABASE_URL: z.string().url().describe("The Postgres connection string"),
  API_KEY: z.string().optional(),
});
