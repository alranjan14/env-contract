const apiKey = process.env.API_KEY;
const databaseUrl = process.env.DATABASE_URL;
const logLevel = process.env.LOG_LEVEL ?? "info";

console.log({ hasApiKey: Boolean(apiKey), databaseUrl, logLevel });
