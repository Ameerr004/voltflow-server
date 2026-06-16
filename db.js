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
  // Cloud databases (Render, Neon, Supabase…) require SSL; localhost does not.
  const url = process.env.DATABASE_URL;
  const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
  client = new pg.Client({
    connectionString: url,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
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

// On a real (cloud) database, create the tables + seed automatically the first
// time the app runs — only if they don't exist yet (so restarts don't duplicate
// data). For pg-mem the schema is already loaded above.
export async function initSchema() {
  if (!process.env.DATABASE_URL) return;
  const check = await client.query("SELECT to_regclass('public.users') AS t");
  if (check.rows[0].t) {
    console.log("📦 Schema already present — skipping init.");
    return;
  }
  const dir = dirname(fileURLToPath(import.meta.url));
  await client.query(readFileSync(join(dir, "schema.sql"), "utf8"));
  console.log("📦 Schema initialised (tables + seed created).");
}

export default client;
