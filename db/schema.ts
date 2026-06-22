import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  bigint,
  integer,
  index,
} from "drizzle-orm/pg-core";

// First registered user becomes admin.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"), // "admin" | "user"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// SK = API keys distributed to clients. Each maps to an owner user and is audited.
export const apiKeys = pgTable(
  "api_keys",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // sk-... hash for O(1) verification (we never reverse this).
    keyHash: text("key_hash").notNull().unique(),
    keyPrefix: text("key_prefix").notNull(), // first chars for display, e.g. sk-abcd...
    // AES-256-GCM ciphertext of the full SK, so the owner can re-copy it later.
    // Null for keys created before reversible storage existed.
    encryptedKey: text("encrypted_key"),
    enabled: boolean("enabled").notNull().default(true),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    keyHashIdx: index("api_keys_key_hash_idx").on(t.keyHash),
  }),
);

// Upstream Claude accounts pooled for rotation. authType: "oauth" | "apikey".
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  authType: text("auth_type").notNull().default("oauth"),
  email: text("email"),
  organizationUuid: text("organization_uuid"),
  accountUuid: text("account_uuid"),
  // For oauth accounts.
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  scope: text("scope"),
  // For apikey accounts.
  apiKey: text("api_key"),
  enabled: boolean("enabled").notNull().default(true),
  // "active" | "expired" | "error"
  status: text("status").notNull().default("active"),
  lastError: text("last_error"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Pending OAuth authorization sessions (PKCE state) for mode1 manual flow.
export const oauthSessions = pgTable("oauth_sessions", {
  id: serial("id").primaryKey(),
  state: text("state").notNull().unique(),
  codeVerifier: text("code_verifier").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Audit log: one row per proxied request.
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    apiKeyId: integer("api_key_id").references(() => apiKeys.id, {
      onDelete: "set null",
    }),
    accountId: integer("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    model: text("model"),
    statusCode: integer("status_code"),
    inputTokens: bigint("input_tokens", { mode: "number" }),
    outputTokens: bigint("output_tokens", { mode: "number" }),
    cacheReadTokens: bigint("cache_read_tokens", { mode: "number" }),
    cacheCreationTokens: bigint("cache_creation_tokens", { mode: "number" }),
    durationMs: integer("duration_ms"),
    stream: boolean("stream"),
    errorMessage: text("error_message"),
    // Full request/response capture for trace-level observability (Langfuse-style).
    // Stored as JSON/text; truncated upstream to keep rows bounded.
    requestBody: text("request_body"),
    responseBody: text("response_body"),
    requestHeaders: text("request_headers"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    createdAtIdx: index("audit_logs_created_at_idx").on(t.createdAt),
    apiKeyIdx: index("audit_logs_api_key_idx").on(t.apiKeyId),
  }),
);
