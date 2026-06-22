import { api } from "encore.dev/api";
import { SQLDB } from "./db";

interface HealthResponse {
  status: string;
  users: number;
}

// Smoke endpoint: confirms migrations applied + DB reachable.
export const health = api(
  { expose: true, method: "GET", path: "/healthz" },
  async (): Promise<HealthResponse> => {
    const row = await SQLDB.queryRow<{ count: number }>`
      SELECT COUNT(*)::int AS count FROM users
    `;
    return { status: "ok", users: row?.count ?? 0 };
  },
);
