import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { eq, desc, and, asc } from "drizzle-orm";
import { db, schema } from "../db/db";
import {
  generatePkce,
  buildAuthorizeUrl,
  exchangeCode,
  refreshToken,
  authorizeViaSessionKey,
  type TokenResponse,
} from "./oauth";

function requireAdmin(): void {
  const a = getAuthData()!;
  if (a.role !== "admin") throw APIError.permissionDenied("admin only");
}

// --- Mode 1: start manual browser authorization ---

interface StartAuthResponse {
  authorizeUrl: string;
  state: string;
}

export const startOAuth = api(
  { expose: true, auth: true, method: "POST", path: "/accounts/oauth/start" },
  async (): Promise<StartAuthResponse> => {
    requireAdmin();
    const pkce = generatePkce();
    await db.insert(schema.oauthSessions).values({ state: pkce.state, codeVerifier: pkce.codeVerifier });
    return { authorizeUrl: buildAuthorizeUrl(pkce), state: pkce.state };
  },
);

interface CompleteAuthRequest {
  name: string;
  state: string;
  code: string; // raw pasted code, may be "code#state"
}

interface AccountInfo {
  id: number;
  name: string;
  authType: string;
  email: string | null;
  enabled: boolean;
  status: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

async function persistOAuthAccount(name: string, token: TokenResponse): Promise<AccountInfo> {
  const expiresAt = new Date(Date.now() + token.expires_in * 1000);
  const [row] = await db
    .insert(schema.accounts)
    .values({
      name,
      authType: "oauth",
      email: token.account?.email_address ?? null,
      organizationUuid: token.organization?.uuid ?? null,
      accountUuid: token.account?.uuid ?? null,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt,
      scope: token.scope,
      status: "active",
    })
    .returning();
  return toInfo(row);
}

export const completeOAuth = api(
  { expose: true, auth: true, method: "POST", path: "/accounts/oauth/complete" },
  async (p: CompleteAuthRequest): Promise<AccountInfo> => {
    requireAdmin();
    const [sess] = await db
      .select()
      .from(schema.oauthSessions)
      .where(eq(schema.oauthSessions.state, p.state))
      .limit(1);
    if (!sess) throw APIError.notFound("oauth session not found or expired");
    const token = await exchangeCode(p.code, sess.codeVerifier, sess.state);
    await db.delete(schema.oauthSessions).where(eq(schema.oauthSessions.id, sess.id));
    return persistOAuthAccount(p.name?.trim() || token.account?.email_address || "claude-account", token);
  },
);

// --- Mode 2: sessionKey auto authorization ---

interface SessionKeyRequest {
  name: string;
  sessionKey: string;
}

export const addViaSessionKey = api(
  { expose: true, auth: true, method: "POST", path: "/accounts/oauth/session-key" },
  async (p: SessionKeyRequest): Promise<AccountInfo> => {
    requireAdmin();
    if (!p.sessionKey?.trim()) throw APIError.invalidArgument("sessionKey required");
    const pkce = generatePkce();
    const codeWithState = await authorizeViaSessionKey(p.sessionKey.trim(), pkce);
    const token = await exchangeCode(codeWithState, pkce.codeVerifier, pkce.state);
    return persistOAuthAccount(p.name?.trim() || token.account?.email_address || "claude-account", token);
  },
);

// --- Mode: raw API key account ---

interface ApiKeyAccountRequest {
  name: string;
  apiKey: string;
}

export const addApiKeyAccount = api(
  { expose: true, auth: true, method: "POST", path: "/accounts/apikey" },
  async (p: ApiKeyAccountRequest): Promise<AccountInfo> => {
    requireAdmin();
    if (!p.apiKey?.trim()) throw APIError.invalidArgument("apiKey required");
    const [row] = await db
      .insert(schema.accounts)
      .values({ name: p.name?.trim() || "apikey-account", authType: "apikey", apiKey: p.apiKey.trim(), status: "active" })
      .returning();
    return toInfo(row);
  },
);

// --- List / toggle / delete ---

interface ListAccountsResponse {
  accounts: AccountInfo[];
}

export const listAccounts = api(
  { expose: true, auth: true, method: "GET", path: "/accounts" },
  async (): Promise<ListAccountsResponse> => {
    requireAdmin();
    const rows = await db.select().from(schema.accounts).orderBy(desc(schema.accounts.createdAt));
    return { accounts: rows.map(toInfo) };
  },
);

interface ToggleAccountRequest {
  id: number;
  enabled: boolean;
}

export const setAccountEnabled = api(
  { expose: true, auth: true, method: "PATCH", path: "/accounts/:id" },
  async (p: ToggleAccountRequest): Promise<{ ok: boolean }> => {
    requireAdmin();
    await db.update(schema.accounts).set({ enabled: p.enabled }).where(eq(schema.accounts.id, p.id));
    return { ok: true };
  },
);

interface AccountIdParam {
  id: number;
}

export const deleteAccount = api(
  { expose: true, auth: true, method: "DELETE", path: "/accounts/:id" },
  async (p: AccountIdParam): Promise<{ ok: boolean }> => {
    requireAdmin();
    await db.delete(schema.accounts).where(eq(schema.accounts.id, p.id));
    return { ok: true };
  },
);

function toInfo(r: typeof schema.accounts.$inferSelect): AccountInfo {
  return {
    id: r.id,
    name: r.name,
    authType: r.authType,
    email: r.email,
    enabled: r.enabled,
    status: r.status,
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

// --- Pool selection + token refresh (used by proxy service) ---

export interface SelectedAccount {
  id: number;
  authType: string;
  credential: string; // access_token (oauth) or apiKey
}

const REFRESH_SKEW_MS = 60_000; // refresh 1min before expiry

// Pick the least-recently-used active account, refreshing its token if near expiry.
export async function selectAccount(): Promise<SelectedAccount | null> {
  const rows = await db
    .select()
    .from(schema.accounts)
    .where(and(eq(schema.accounts.enabled, true), eq(schema.accounts.status, "active")))
    .orderBy(asc(schema.accounts.lastUsedAt));
  if (rows.length === 0) return null;

  // asc nulls first puts never-used accounts first in Postgres; good for cold start.
  const acc = rows[0];

  let credential: string;
  if (acc.authType === "apikey") {
    if (!acc.apiKey) {
      await markError(acc.id, "missing api key");
      return null;
    }
    credential = acc.apiKey;
  } else {
    let accessToken = acc.accessToken;
    const expMs = acc.expiresAt ? acc.expiresAt.getTime() : 0;
    if (!accessToken || Date.now() >= expMs - REFRESH_SKEW_MS) {
      if (!acc.refreshToken) {
        await markError(acc.id, "no refresh token");
        return null;
      }
      try {
        const t = await refreshToken(acc.refreshToken);
        accessToken = t.access_token;
        await db
          .update(schema.accounts)
          .set({
            accessToken: t.access_token,
            refreshToken: t.refresh_token ?? acc.refreshToken,
            expiresAt: new Date(Date.now() + t.expires_in * 1000),
            scope: t.scope ?? acc.scope,
            status: "active",
            lastError: null,
          })
          .where(eq(schema.accounts.id, acc.id));
      } catch (err) {
        await markError(acc.id, String(err));
        return null;
      }
    }
    credential = accessToken!;
  }

  await db.update(schema.accounts).set({ lastUsedAt: new Date() }).where(eq(schema.accounts.id, acc.id));
  return { id: acc.id, authType: acc.authType, credential };
}

async function markError(id: number, msg: string): Promise<void> {
  await db.update(schema.accounts).set({ status: "error", lastError: msg }).where(eq(schema.accounts.id, id));
}
