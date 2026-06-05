import { neon } from "@neondatabase/serverless";
import "dotenv/config";

async function dropUsers() {
  const sql = neon(process.env.DATABASE_URL!);
  try {
    await sql`DROP TABLE IF EXISTS "users" CASCADE;`;
    console.log("Users table dropped.");
  } catch (e) {
    console.error(e);
  }
}
dropUsers();
