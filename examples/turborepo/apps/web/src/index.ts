// Each package has its own schema and .env.example. `env-contract check
// --workspace` (run from the repo root) discovers both packages and checks each.
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const sessionSecret = process.env.SESSION_SECRET;

console.log({ apiUrl, hasSessionSecret: Boolean(sessionSecret) });
