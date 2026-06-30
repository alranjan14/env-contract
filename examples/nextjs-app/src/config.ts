// Reading `process.env.*` directly — env-contract scans these references and
// checks them against src/env.ts. Add one that isn't in the schema and
// `env-contract check` fails, pointing at the file and line.
export const config = {
  databaseUrl: process.env.DATABASE_URL,
  authSecret: process.env.AUTH_SECRET,
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
};
