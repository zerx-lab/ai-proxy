// Standalone drizzle migrator for self-hosted deployments.
// Applies db/migrations/*.sql to the target Postgres before the app starts.
// Connection from DATABASE_URL or discrete PG* env vars.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const url =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.PGUSER || "gateway"}:${encodeURIComponent(
    process.env.PGPASSWORD || "",
  )}@${process.env.PGHOST || "db"}:${process.env.PGPORT || "5432"}/${process.env.PGDATABASE || "gateway"}`;

const pool = new pg.Pool({ connectionString: url });
const db = drizzle(pool);

console.log("applying migrations from ./db/migrations ...");
await migrate(db, { migrationsFolder: "./db/migrations" });
console.log("migrations applied.");
await pool.end();
