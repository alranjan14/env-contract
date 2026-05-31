import { z } from "zod";

export const envSchema = {
  _def: {},
  _server: z.object({
    DATABASE_URL: z.string().url().describe("Production postgres database link"),
  }),
  _client: z.object({
    NEXT_PUBLIC_API_URL: z.string().url().describe("Frontend API gateway"),
  }),
};
