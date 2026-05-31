import { z } from "zod";

// Shape representing t3-env with custom presets
export const envSchema = {
  _def: {},
  _server: z.object({
    DATABASE_URL: z.string().url().describe("Main DATABASE_URL"),
  }),
  _client: z.object({
    NEXT_PUBLIC_API_URL: z.string().url().describe("Main API URL"),
  }),
  // presets would be here, but we will mock them in the test environment if needed
};
