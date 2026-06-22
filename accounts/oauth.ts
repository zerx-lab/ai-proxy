import { randomBytes, createHash } from "node:crypto";
import { upstreamFetch } from "./fetch";

// Anthropic Claude Code OAuth client (public, well-known).
export const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
export const AUTHORIZE_URL = "https://claude.ai/oauth/authorize";
// Anthropic OAuth token service (verified: console.anthropic.com 404s — this path
// is the live one). All anthropic.com / claude.com endpoints are geo/IP gated; a
// blocked egress IP yields 403 "Request not allowed" — route via UPSTREAM_PROXY.
export const TOKEN_URL = "https://platform.claude.com/v1/oauth/token";
export const REDIRECT_URI = "https://platform.claude.com/oauth/code/callback";
export const SCOPE =
  "org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload";

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface Pkce {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
}

export function generatePkce(): Pkce {
  const codeVerifier = b64url(randomBytes(32));
  const codeChallenge = b64url(createHash("sha256").update(codeVerifier).digest());
  const state = b64url(randomBytes(32));
  return { state, codeVerifier, codeChallenge };
}

export function buildAuthorizeUrl(pkce: Pkce): string {
  const params = new URLSearchParams({
    code: "true",
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    code_challenge: pkce.codeChallenge,
    code_challenge_method: "S256",
    state: pkce.state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

const REQUEST_HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "axios/1.13.6",
  Accept: "application/json, text/plain, */*",
};

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  organization?: { uuid: string };
  account?: { uuid: string; email_address: string };
}

// Exchange an authorization code for tokens. The code may be "code#state"; if the
// hash form isn't present, fall back to the explicit state from the auth session.
// The token endpoint REQUIRES state — omitting it yields "Invalid request format".
export async function exchangeCode(
  rawCode: string,
  codeVerifier: string,
  fallbackState?: string,
): Promise<TokenResponse> {
  const [code, hashState] = rawCode.split("#");
  const state = (hashState ?? fallbackState ?? "").trim();
  const body: Record<string, string> = {
    code: code.trim(),
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  };
  if (state) body.state = state;

  const resp = await upstreamFetch(TOKEN_URL, {
    method: "POST",
    headers: REQUEST_HEADERS,
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new Error(`token exchange failed: ${resp.status} ${await resp.text()}`);
  }
  return (await resp.json()) as TokenResponse;
}

export async function refreshToken(refreshTok: string): Promise<TokenResponse> {
  const resp = await upstreamFetch(TOKEN_URL, {
    method: "POST",
    headers: REQUEST_HEADERS,
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshTok,
      client_id: CLIENT_ID,
    }),
  });
  if (!resp.ok) {
    throw new Error(`token refresh failed: ${resp.status} ${await resp.text()}`);
  }
  return (await resp.json()) as TokenResponse;
}

// --- Mode 2: sessionKey auto-authorization ---

interface Org {
  uuid: string;
  raven_type?: string;
}

// Given a claude.ai sessionKey cookie, auto-complete the authorization flow and
// return a "code#state" string ready for exchangeCode.
export async function authorizeViaSessionKey(sessionKey: string, pkce: Pkce): Promise<string> {
  const orgsResp = await upstreamFetch("https://claude.ai/api/organizations", {
    headers: {
      Cookie: `sessionKey=${sessionKey}`,
      "User-Agent": "axios/1.13.6",
      Accept: "application/json",
    },
  });
  if (!orgsResp.ok) {
    throw new Error(`fetch organizations failed: ${orgsResp.status} ${await orgsResp.text()}`);
  }
  const orgs = (await orgsResp.json()) as Org[];
  if (!Array.isArray(orgs) || orgs.length === 0) {
    throw new Error("no organizations found for sessionKey");
  }
  const org = orgs.find((o) => o.raven_type === "team") ?? orgs[0];

  const authResp = await upstreamFetch(`https://claude.ai/v1/oauth/${org.uuid}/authorize`, {
    method: "POST",
    headers: {
      Cookie: `sessionKey=${sessionKey}`,
      "Content-Type": "application/json",
      "User-Agent": "axios/1.13.6",
      Accept: "application/json",
      Origin: "https://claude.ai",
      Referer: "https://claude.ai/",
    },
    body: JSON.stringify({
      response_type: "code",
      client_id: CLIENT_ID,
      organization_uuid: org.uuid,
      redirect_uri: REDIRECT_URI,
      scope: SCOPE,
      state: pkce.state,
      code_challenge: pkce.codeChallenge,
      code_challenge_method: "S256",
    }),
  });
  if (!authResp.ok) {
    throw new Error(`sessionKey authorize failed: ${authResp.status} ${await authResp.text()}`);
  }
  const data = (await authResp.json()) as { redirect_uri?: string };
  if (!data.redirect_uri) throw new Error("authorize response missing redirect_uri");

  const url = new URL(data.redirect_uri);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? pkce.state;
  if (!code) throw new Error("authorize redirect missing code");
  return `${code}#${state}`;
}
