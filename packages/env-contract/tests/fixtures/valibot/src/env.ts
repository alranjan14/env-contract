import * as v from "valibot";

// A Valibot object schema — exercises the Valibot loader end-to-end (loadSchema
// + scan + check), not just the unit introspector.
export const envSchema = v.object({
  API_KEY: v.string(),
  DATABASE_URL: v.string(),
  LOG_LEVEL: v.optional(v.string(), "info"),
});
