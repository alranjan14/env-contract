import { z } from "zod";

export const envSchema = z.object({
  PORT: z.string().default("8080"),
  API_SECRET: z.string().describe("Internal API secret token"),
});
