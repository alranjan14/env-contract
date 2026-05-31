import { z } from "zod";

export const envSchema = z.object({
  PORT: z.string().default("8080"),
});
