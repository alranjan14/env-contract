import { defineConfig } from "env-contract";

export default defineConfig({
  // `NODE_ENV` is provided by Next/Node, and `SKIP_ENV_VALIDATION` is the t3-env
  // build escape hatch — neither belongs in your schema, so don't flag them.
  ignoreKeys: ["NODE_ENV", "SKIP_ENV_VALIDATION"],
});
