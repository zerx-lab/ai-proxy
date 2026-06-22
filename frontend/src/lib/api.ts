// ---------------------------------------------------------------------------
// Typed API client — single place that injects base URL + Bearer token
// ---------------------------------------------------------------------------

export const BASE_URL: string =
  (import.meta.env as Record<string, string>).VITE_API_URL ?? 'http://localhost:4000'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const json = (await res.json()) as { message?: string; error?: string }
      msg = json.message ?? json.error ?? JSON.stringify(json)
    } catch {
      const text = await res.text().catch(() => '')
      if (text) msg = text
    }
    throw new Error(msg)
  }

  // 204 No Content or empty body
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export interface AuthUser {
  id: string
  email: string
  role: string
}
export interface AuthResponse {
  token: string
  user: AuthUser
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),
  signup: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/signup', { email, password }),
  me: () => api.get<AuthUser>('/auth/me'),
}

// ---------------------------------------------------------------------------
// API Keys
// ---------------------------------------------------------------------------
export interface ApiKey {
  id: number
  name: string
  keyPrefix: string
  enabled: boolean
  lastUsedAt: string | null
  createdAt: string
}
export interface CreatedApiKey extends ApiKey {
  key: string
}

export const keysApi = {
  list: () => api.get<{ keys: ApiKey[] }>('/keys'),
  create: (name: string) => api.post<CreatedApiKey>('/keys', { name }),
  toggle: (id: number, enabled: boolean) =>
    api.patch<{ ok: boolean }>(`/keys/${id}`, { id, enabled }),
  delete: (id: number) => api.delete<{ ok: boolean }>(`/keys/${id}`),
  reveal: (id: number) => api.get<{ key: string }>(`/keys/${id}/reveal`),
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------
export interface AccountInfo {
  id: number
  name: string
  authType: string
  email: string | null
  enabled: boolean
  status: string
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
}

export const accountsApi = {
  list: () => api.get<{ accounts: AccountInfo[] }>('/accounts'),
  oauthStart: () =>
    api.post<{ authorizeUrl: string; state: string }>('/accounts/oauth/start', {}),
  oauthComplete: (name: string, state: string, code: string) =>
    api.post<AccountInfo>('/accounts/oauth/complete', { name, state, code }),
  oauthSessionKey: (name: string, sessionKey: string) =>
    api.post<AccountInfo>('/accounts/oauth/session-key', { name, sessionKey }),
  addApiKey: (name: string, apiKey: string) =>
    api.post<AccountInfo>('/accounts/apikey', { name, apiKey }),
  toggle: (id: number, enabled: boolean) =>
    api.patch<{ ok: boolean }>(`/accounts/${id}`, { id, enabled }),
  delete: (id: number) => api.delete<{ ok: boolean }>(`/accounts/${id}`),
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------
export interface AuditEntry {
  id: number
  apiKeyId: number | null
  accountId: number | null
  model: string | null
  statusCode: number | null
  inputTokens: number | null
  outputTokens: number | null
  durationMs: number | null
  stream: boolean | null
  errorMessage: string | null
  createdAt: string
}
export interface AuditStats {
  totalRequests: number
  totalInputTokens: number
  totalOutputTokens: number
  errorRequests: number
}

export interface ObsTimePoint {
  bucket: string
  requests: number
  inputTokens: number
  outputTokens: number
  errors: number
}
export interface ObsModelStat {
  model: string
  requests: number
  inputTokens: number
  outputTokens: number
}
export interface ObsStatusStat {
  statusClass: string
  requests: number
}
export interface Observability {
  windowHours: number
  totalRequests: number
  errorRequests: number
  avgDurationMs: number
  p95DurationMs: number
  totalInputTokens: number
  totalOutputTokens: number
  series: ObsTimePoint[]
  models: ObsModelStat[]
  statuses: ObsStatusStat[]
}

export interface AuditDetail extends AuditEntry {
  cacheReadTokens: number | null
  cacheCreationTokens: number | null
  requestBody: string | null
  responseBody: string | null
  requestHeaders: string | null
}

export const auditApi = {
  list: (limit = 100) =>
    api.get<{ entries: AuditEntry[] }>(`/audit?limit=${limit}`),
  stats: () => api.get<AuditStats>('/audit/stats'),
  observability: (hours = 24) =>
    api.get<Observability>(`/audit/observability?hours=${hours}`),
  detail: (id: number) => api.get<AuditDetail>(`/audit/${id}`),
}
