import express from "express";

// These `process.env.*` references are what `env-contract scan` cross-checks
// against src/env.ts. Add a `process.env.NEW_VAR` that isn't in the schema and
// `env-contract check` will fail — that's the whole point.
const app = express();

const port = process.env.PORT ?? 3000;
const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;
const logLevel = process.env.LOG_LEVEL ?? "info";

app.get("/health", (_req, res) => {
  res.json({ ok: true, db: Boolean(databaseUrl), logLevel });
});

app.listen(port, () => {
  console.log(`listening on :${port} (jwt secret length: ${jwtSecret?.length ?? 0})`);
});
