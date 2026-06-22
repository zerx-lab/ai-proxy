import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { eq, desc, sql, and } from "drizzle-orm";
import { db, schema } from "../db/db";
import { Query } from "encore.dev/api";

interface AuditEntry {
  id: number;
  apiKeyId: number | null;
  accountId: number | null;
  model: string | null;
  statusCode: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number | null;
  stream: boolean | null;
  errorMessage: string | null;
  createdAt: string;
}

interface ListAuditRequest {
  limit?: Query<number>;
}

interface ListAuditResponse {
  entries: AuditEntry[];
}

// Admins see all audit logs; regular users see only logs for their own keys.
export const listAudit = api(
  { expose: true, auth: true, method: "GET", path: "/audit" },
  async (p: ListAuditRequest): Promise<ListAuditResponse> => {
    const a = getAuthData()!;
    const limit = Math.min(Math.max(p.limit ?? 100, 1), 500);

    const base = db
      .select({
        id: schema.auditLogs.id,
        apiKeyId: schema.auditLogs.apiKeyId,
        accountId: schema.auditLogs.accountId,
        model: schema.auditLogs.model,
        statusCode: schema.auditLogs.statusCode,
        inputTokens: schema.auditLogs.inputTokens,
        outputTokens: schema.auditLogs.outputTokens,
        durationMs: schema.auditLogs.durationMs,
        stream: schema.auditLogs.stream,
        errorMessage: schema.auditLogs.errorMessage,
        createdAt: schema.auditLogs.createdAt,
      })
      .from(schema.auditLogs);

    const rows =
      a.role === "admin"
        ? await base.orderBy(desc(schema.auditLogs.createdAt)).limit(limit)
        : await base
            .innerJoin(schema.apiKeys, eq(schema.auditLogs.apiKeyId, schema.apiKeys.id))
            .where(eq(schema.apiKeys.userId, Number(a.userID)))
            .orderBy(desc(schema.auditLogs.createdAt))
            .limit(limit);

    return {
      entries: rows.map((r) => ({
        id: r.id,
        apiKeyId: r.apiKeyId,
        accountId: r.accountId,
        model: r.model,
        statusCode: r.statusCode,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        durationMs: r.durationMs,
        stream: r.stream,
        errorMessage: r.errorMessage,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  },
);

interface StatsResponse {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  errorRequests: number;
}

export const stats = api(
  { expose: true, auth: true, method: "GET", path: "/audit/stats" },
  async (): Promise<StatsResponse> => {
    const [row] = await db
      .select({
        totalRequests: sql<number>`COUNT(*)::int`,
        totalInputTokens: sql<number>`COALESCE(SUM(${schema.auditLogs.inputTokens}),0)::int`,
        totalOutputTokens: sql<number>`COALESCE(SUM(${schema.auditLogs.outputTokens}),0)::int`,
        errorRequests: sql<number>`COUNT(*) FILTER (WHERE ${schema.auditLogs.statusCode} >= 400)::int`,
      })
      .from(schema.auditLogs);
    return {
      totalRequests: row?.totalRequests ?? 0,
      totalInputTokens: row?.totalInputTokens ?? 0,
      totalOutputTokens: row?.totalOutputTokens ?? 0,
      errorRequests: row?.errorRequests ?? 0,
    };
  },
);

// ---------------------------------------------------------------------------
// Observability — time-series, model/status breakdowns, latency percentiles.
// Admins see the whole gateway; regular users see only their own keys' traffic.
// ---------------------------------------------------------------------------

interface ObservabilityRequest {
  hours?: Query<number>;
}

interface TimePoint {
  bucket: string; // ISO timestamp at hour granularity
  requests: number;
  inputTokens: number;
  outputTokens: number;
  errors: number;
}

interface ModelStat {
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
}

interface StatusStat {
  statusClass: string; // "2xx" | "4xx" | "5xx" | "—"
  requests: number;
}

interface ObservabilityResponse {
  windowHours: number;
  totalRequests: number;
  errorRequests: number;
  avgDurationMs: number;
  p95DurationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  series: TimePoint[];
  models: ModelStat[];
  statuses: StatusStat[];
}

export const observability = api(
  { expose: true, auth: true, method: "GET", path: "/audit/observability" },
  async (p: ObservabilityRequest): Promise<ObservabilityResponse> => {
    const a = getAuthData()!;
    const hours = Math.min(Math.max(p.hours ?? 24, 1), 720);
    const isAdmin = a.role === "admin";
    const userId = Number(a.userID);

    // Scope filter: admins see everything; users see only audit rows whose
    // api_key belongs to them. Bind via a CTE of allowed api_key ids.
    const scope = isAdmin
      ? sql`TRUE`
      : sql`al.api_key_id IN (SELECT id FROM api_keys WHERE user_id = ${userId})`;
    const sinceClause = sql`al.created_at >= NOW() - (${hours} || ' hours')::interval`;
    const where = sql`WHERE ${sinceClause} AND ${scope}`;

    const seriesRows = await db.execute<{
      bucket: Date;
      requests: number;
      input_tokens: number;
      output_tokens: number;
      errors: number;
    }>(sql`
      SELECT
        date_trunc('hour', al.created_at) AS bucket,
        COUNT(*)::int AS requests,
        COALESCE(SUM(al.input_tokens), 0)::int AS input_tokens,
        COALESCE(SUM(al.output_tokens), 0)::int AS output_tokens,
        COUNT(*) FILTER (WHERE al.status_code >= 400)::int AS errors
      FROM audit_logs al
      ${where}
      GROUP BY bucket
      ORDER BY bucket ASC
    `);

    const summaryRows = await db.execute<{
      total: number;
      errors: number;
      avg_ms: number;
      p95_ms: number;
      input_tokens: number;
      output_tokens: number;
    }>(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE al.status_code >= 400)::int AS errors,
        COALESCE(AVG(al.duration_ms), 0)::int AS avg_ms,
        COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY al.duration_ms), 0)::int AS p95_ms,
        COALESCE(SUM(al.input_tokens), 0)::int AS input_tokens,
        COALESCE(SUM(al.output_tokens), 0)::int AS output_tokens
      FROM audit_logs al
      ${where}
    `);

    const modelRows = await db.execute<{
      model: string | null;
      requests: number;
      input_tokens: number;
      output_tokens: number;
    }>(sql`
      SELECT
        al.model AS model,
        COUNT(*)::int AS requests,
        COALESCE(SUM(al.input_tokens), 0)::int AS input_tokens,
        COALESCE(SUM(al.output_tokens), 0)::int AS output_tokens
      FROM audit_logs al
      ${where}
      GROUP BY al.model
      ORDER BY requests DESC
      LIMIT 10
    `);

    const statusRows = await db.execute<{ status_class: string; requests: number }>(sql`
      SELECT
        CASE
          WHEN al.status_code >= 500 THEN '5xx'
          WHEN al.status_code >= 400 THEN '4xx'
          WHEN al.status_code >= 200 THEN '2xx'
          ELSE '—'
        END AS status_class,
        COUNT(*)::int AS requests
      FROM audit_logs al
      ${where}
      GROUP BY status_class
      ORDER BY requests DESC
    `);

    const sum = summaryRows.rows[0];
    return {
      windowHours: hours,
      totalRequests: sum?.total ?? 0,
      errorRequests: sum?.errors ?? 0,
      avgDurationMs: sum?.avg_ms ?? 0,
      p95DurationMs: sum?.p95_ms ?? 0,
      totalInputTokens: sum?.input_tokens ?? 0,
      totalOutputTokens: sum?.output_tokens ?? 0,
      series: seriesRows.rows.map((r) => ({
        bucket: new Date(r.bucket).toISOString(),
        requests: r.requests,
        inputTokens: r.input_tokens,
        outputTokens: r.output_tokens,
        errors: r.errors,
      })),
      models: modelRows.rows.map((r) => ({
        model: r.model ?? "unknown",
        requests: r.requests,
        inputTokens: r.input_tokens,
        outputTokens: r.output_tokens,
      })),
      statuses: statusRows.rows.map((r) => ({
        statusClass: r.status_class,
        requests: r.requests,
      })),
    };
  },
);

// ---------------------------------------------------------------------------
// Single audit entry detail — full request/response capture for trace view.
// Admins can see any entry; users only entries tied to their own keys.
// ---------------------------------------------------------------------------

interface AuditDetailParams {
  id: number;
}

interface AuditDetail {
  id: number;
  apiKeyId: number | null;
  accountId: number | null;
  model: string | null;
  statusCode: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  durationMs: number | null;
  stream: boolean | null;
  errorMessage: string | null;
  requestBody: string | null;
  responseBody: string | null;
  requestHeaders: string | null;
  createdAt: string;
}

export const auditDetail = api(
  { expose: true, auth: true, method: "GET", path: "/audit/:id" },
  async (p: AuditDetailParams): Promise<AuditDetail> => {
    const a = getAuthData()!;

    const sel = {
      id: schema.auditLogs.id,
      apiKeyId: schema.auditLogs.apiKeyId,
      accountId: schema.auditLogs.accountId,
      model: schema.auditLogs.model,
      statusCode: schema.auditLogs.statusCode,
      inputTokens: schema.auditLogs.inputTokens,
      outputTokens: schema.auditLogs.outputTokens,
      cacheReadTokens: schema.auditLogs.cacheReadTokens,
      cacheCreationTokens: schema.auditLogs.cacheCreationTokens,
      durationMs: schema.auditLogs.durationMs,
      stream: schema.auditLogs.stream,
      errorMessage: schema.auditLogs.errorMessage,
      requestBody: schema.auditLogs.requestBody,
      responseBody: schema.auditLogs.responseBody,
      requestHeaders: schema.auditLogs.requestHeaders,
      createdAt: schema.auditLogs.createdAt,
    };

    const rows =
      a.role === "admin"
        ? await db.select(sel).from(schema.auditLogs).where(eq(schema.auditLogs.id, p.id)).limit(1)
        : await db
            .select(sel)
            .from(schema.auditLogs)
            .innerJoin(schema.apiKeys, eq(schema.auditLogs.apiKeyId, schema.apiKeys.id))
            .where(and(eq(schema.auditLogs.id, p.id), eq(schema.apiKeys.userId, Number(a.userID))))
            .limit(1);

    const r = rows[0];
    if (!r) throw APIError.notFound("audit entry not found");

    return {
      id: r.id,
      apiKeyId: r.apiKeyId,
      accountId: r.accountId,
      model: r.model,
      statusCode: r.statusCode,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      cacheReadTokens: r.cacheReadTokens,
      cacheCreationTokens: r.cacheCreationTokens,
      durationMs: r.durationMs,
      stream: r.stream,
      errorMessage: r.errorMessage,
      requestBody: r.requestBody,
      responseBody: r.responseBody,
      requestHeaders: r.requestHeaders,
      createdAt: r.createdAt.toISOString(),
    };
  },
);
