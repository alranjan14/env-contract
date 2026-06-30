const databaseUrl = process.env.DATABASE_URL;
const port = process.env.PORT ?? 8080;
const redisUrl = process.env.REDIS_URL;

console.log({ databaseUrl, port, hasRedis: Boolean(redisUrl) });
