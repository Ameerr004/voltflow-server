import pg from "pg";
import { newDb } from "pg-mem";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
dotenv.config();

let client;

if (process.env.DATABASE_URL) {
  // Production / real setup — connect to a real PostgreSQL instance.
  client = new pg.Client(process.env.DATABASE_URL);
} else {
  // Dev fallback: zero-install in-memory PostgreSQL so the app runs without
  // installing/configuring a database. Schema + seed are loaded from schema.sql.
  // NOTE: data resets every time the server restarts.
  const mem = newDb();
  const __dirname = dirname(fileURLToPath(import.meta.url));
  mem.public.none(readFileSync(join(__dirname, "schema.sql"), "utf8"));
  const { Client } = mem.adapters.createPg();
  client = new Client();
  console.log("⚠  No DATABASE_URL set — using in-memory pg-mem database (data resets on restart).");
}

export default client;
