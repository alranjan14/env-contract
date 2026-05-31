export default function Page() {
  const api = process.env.NEXT_PUBLIC_API_URL;
  const db = process.env.DATABASE_URL;
  console.log(api, db);
  return null;
}
