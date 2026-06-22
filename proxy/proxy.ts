import { api } from "encore.dev/api";
import log from "encore.dev/log";
import { db, schema } from "../db/db";
import { verifyApiKey } from "../keys/keys";
import { selectAccount } from "../accounts/accounts";
import { upstreamFetch } from "../accounts/fetch";
import {
  UPSTREAM_URL,
  buildUpstreamHeaders,
  rewriteBody,
  parseUsageFromJson,
  parseUsageFromSse,
  restoreToolNames,
  type Usage,
} from "./upstream";
import type { IncomingMessage, ServerResponse } from "node:http";

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function extractKey(req: IncomingMessage): string {
  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth.startsWith("Bearer ")) return auth.slice(7);
  const xkey = req.headers["x-api-key"];
  if (typeof xkey === "string") return xkey;
  if (typeof auth === "string") return auth;
  return "";
}

function sendError(resp: ServerResponse, status: number, code: string, message: string): void {
  resp.writeHead(status, { "Content-Type": "application/json" });
  resp.end(JSON.stringify({ type: "error", error: { type: code, message } }));
}

// Cap stored bodies so a single huge payload can't bloat the audit table.
const MAX_CAPTURE = 256 * 1024; // 256 KB

function cap(s: string): string {
  return s.length > MAX_CAPTURE ? s.slice(0, MAX_CAPTURE) + "\n…[truncated]" : s;
}

// Keep only non-sensitive request headers for the trace view.
function sanitizeHeaders(req: IncomingMessage): string {
  const redacted = new Set(["authorization", "x-api-key", "cookie", "proxy-authorization"]);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    out[k] = redacted.has(k.toLowerCase()) ? "[redacted]" : Array.isArray(v) ? v.join(", ") : v;
  }
  return JSON.stringify(out);
}

// Anthropic-compatible proxy. Clients point ANTHROPIC_BASE_URL here and use an SK.
export const messages = api.raw(
  { expose: true, method: "POST", path: "/v1/messages" },
  async (req, resp) => {
    const startedAt = Date.now();
    const rawKey = extractKey(req);
    const verified = await verifyApiKey(rawKey);
    if (!verified) {
      sendError(resp, 401, "authentication_error", "invalid or disabled API key");
      return;
    }

    const account = await selectAccount();
    if (!account) {
      sendError(resp, 503, "overloaded_error", "no available upstream account");
      return;
    }

    const rawBody = await readBody(req);
    const sessionHeader = req.headers["x-session-id"];
    const sessionId = typeof sessionHeader === "string" ? sessionHeader : undefined;
    const { body, model, stream, toolNameRewrite } = rewriteBody(rawBody, {
      accountUuid: account.accountUuid,
      sessionId,
    });

    let upstream: Response;
    try {
      upstream = await upstreamFetch(UPSTREAM_URL, {
        method: "POST",
        headers: buildUpstreamHeaders(account.authType, account.credential),
        body,
      });
    } catch (err) {
      await writeAudit(verified.id, account.id, model, 502, stream, {}, Date.now() - startedAt, String(err), {
        requestBody: cap(rawBody.toString("utf8")),
        responseBody: null,
        requestHeaders: sanitizeHeaders(req),
      });
      sendError(resp, 502, "api_error", "upstream request failed");
      return;
    }

    const status = upstream.status;
    const contentType = upstream.headers.get("content-type") ?? "application/json";
    resp.writeHead(status, { "Content-Type": contentType });

    let usage: Usage = {};
    let errorMessage: string | null = null;
    let responseBody: string | null = null;

    if (!upstream.body) {
      resp.end();
    } else if (stream && contentType.includes("event-stream")) {
      // Tee the SSE stream: forward to client while accumulating for usage parsing.
      // Restore renamed tool names per complete line so a fake name can't be split
      // across chunk boundaries.
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let captured = "";
      let pending = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        captured += chunk;
        pending += chunk;
        const nl = pending.lastIndexOf("\n");
        if (nl >= 0) {
          const flush = pending.slice(0, nl + 1);
          pending = pending.slice(nl + 1);
          resp.write(toolNameRewrite ? restoreToolNames(flush, toolNameRewrite) : flush);
        }
      }
      if (pending.length > 0) {
        resp.write(toolNameRewrite ? restoreToolNames(pending, toolNameRewrite) : pending);
      }
      resp.end();
      usage = parseUsageFromSse(captured);
      responseBody = cap(captured);
      if (status >= 400) errorMessage = captured.slice(0, 500);
    } else {
      const text = await upstream.text();
      const restored = toolNameRewrite ? restoreToolNames(text, toolNameRewrite) : text;
      resp.end(restored);
      usage = parseUsageFromJson(text);
      responseBody = cap(restored);
      if (status >= 400) errorMessage = text.slice(0, 500);
    }

    await writeAudit(verified.id, account.id, model, status, stream, usage, Date.now() - startedAt, errorMessage, {
      requestBody: cap(rawBody.toString("utf8")),
      responseBody,
      requestHeaders: sanitizeHeaders(req),
    });
    if (status >= 400) {
      log.warn("proxy upstream error", { status, accountId: account.id, model });
    }
  },
);

// Lists available models. Claude Code calls this before /v1/messages. We proxy the
// GET to the upstream so the list reflects what the selected account can actually use.
export const models = api.raw(
  { expose: true, method: "GET", path: "/v1/models" },
  async (req, resp) => {
    const verified = await verifyApiKey(extractKey(req));
    if (!verified) {
      sendError(resp, 401, "authentication_error", "invalid or disabled API key");
      return;
    }
    const account = await selectAccount();
    if (!account) {
      sendError(resp, 503, "overloaded_error", "no available upstream account");
      return;
    }
    try {
      const upstream = await upstreamFetch("https://api.anthropic.com/v1/models?limit=1000", {
        method: "GET",
        headers: buildUpstreamHeaders(account.authType, account.credential),
      });
      const text = await upstream.text();
      resp.writeHead(upstream.status, {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      });
      resp.end(text);
    } catch {
      sendError(resp, 502, "api_error", "upstream request failed");
    }
  },
);

async function writeAudit(
  apiKeyId: number,
  accountId: number,
  model: string | undefined,
  statusCode: number,
  stream: boolean,
  usage: Usage,
  durationMs: number,
  errorMessage: string | null,
  capture: { requestBody: string | null; responseBody: string | null; requestHeaders: string | null },
): Promise<void> {
  try {
    await db.insert(schema.auditLogs).values({
      apiKeyId,
      accountId,
      model: model ?? null,
      statusCode,
      inputTokens: usage.inputTokens ?? null,
      outputTokens: usage.outputTokens ?? null,
      cacheReadTokens: usage.cacheReadTokens ?? null,
      cacheCreationTokens: usage.cacheCreationTokens ?? null,
      durationMs,
      stream,
      errorMessage,
      requestBody: capture.requestBody,
      responseBody: capture.responseBody,
      requestHeaders: capture.requestHeaders,
    });
  } catch (err) {
    log.error("failed to write audit log", { err: String(err) });
  }
}
