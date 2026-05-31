console.log("Starting server on port", process.env.PORT);
console.log("Connecting to", process.env.DATABASE_URL);

if (process.env.API_KEY) {
  console.log("API Key configured!");
}
