import { SQLDatabase } from "encore.dev/storage/sqldb";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Single logical database for the whole app. Drizzle generates migrations into
// ./migrations; Encore applies them automatically at runtime.
export const SQLDB = new SQLDatabase("gateway", {
  migrations: {
    path: "migrations",
    source: "drizzle",
  },
});

export const db = drizzle(SQLDB.connectionString, { schema });
export { schema };
