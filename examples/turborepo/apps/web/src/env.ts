import { z } from "zod";

export const env = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().describe("Public API base URL"),
  SESSION_SECRET: z.string().min(16).describe("Web session secret"),
});
