console.log("Listening on", process.env.PORT);

// This is an untracked orphaned reference!
const token = process.env.SECRET_API_TOKEN;
console.log("Token length:", token?.length);
