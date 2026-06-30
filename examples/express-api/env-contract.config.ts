import { defineConfig } from "env-contract";

export default defineConfig({
  // `schema` and `exampleFile` are auto-detected here, so they're omitted.
  // `NODE_ENV` is set by the runtime, not your schema — never flag it as drift.
  ignoreKeys: ["NODE_ENV"],
});
