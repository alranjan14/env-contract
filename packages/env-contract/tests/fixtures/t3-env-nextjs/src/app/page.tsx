export default function Page() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  console.log("Client connecting to", apiUrl);
  
  // server code
  if (typeof window === "undefined") {
    console.log("Database connection:", process.env.DATABASE_URL);
  }

  return (
    <div>
      <h1>Welcome to Next.js</h1>
      <p>API Endpoint: {apiUrl}</p>
    </div>
  );
}
