import { z } from "zod";

export const env = z.object({
  DATABASE_URL: z.string().url().describe("Postgres connection string"),
  PORT: z.coerce.number().default(8080).describe("API port"),
  REDIS_URL: z.string().url().optional().describe("Redis cache URL"),
});
