import { defineConfig } from "drizzle-kit";

// Encore manages the actual DB connection + applies migrations at runtime.
// drizzle-kit is only used to GENERATE migration SQL from schema.ts:
//   npx drizzle-kit generate
export default defineConfig({
  out: "db/migrations",
  schema: "db/schema.ts",
  dialect: "postgresql",
});
