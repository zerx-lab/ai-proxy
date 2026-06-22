import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "../db/db";
import { secret } from "encore.dev/config";
import { generateApiKey, sha256, encryptSecret, decryptSecret } from "../auth/crypto";

const keyEncryptionKey = secret("KeyEncryptionKey");

interface CreateKeyRequest {
  name: string;
}

interface CreateKeyResponse {
  id: number;
  name: string;
  key: string; // full key shown only once
  keyPrefix: string;
}

export const createKey = api(
  { expose: true, auth: true, method: "POST", path: "/keys" },
  async (p: CreateKeyRequest): Promise<CreateKeyResponse> => {
    const a = getAuthData()!;
    const name = p.name?.trim() || "default";
    const { key, hash, prefix } = generateApiKey();
    const [row] = await db
      .insert(schema.apiKeys)
      .values({
        userId: Number(a.userID),
        name,
        keyHash: hash,
        keyPrefix: prefix,
        encryptedKey: encryptSecret(key, keyEncryptionKey()),
      })
      .returning();
    return { id: row.id, name: row.name, key, keyPrefix: row.keyPrefix };
  },
);

interface KeyInfo {
  id: number;
  name: string;
  keyPrefix: string;
  enabled: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

interface ListKeysResponse {
  keys: KeyInfo[];
}

// Admins see all keys; regular users see only their own.
export const listKeys = api(
  { expose: true, auth: true, method: "GET", path: "/keys" },
  async (): Promise<ListKeysResponse> => {
    const a = getAuthData()!;
    const rows =
      a.role === "admin"
        ? await db.select().from(schema.apiKeys).orderBy(desc(schema.apiKeys.createdAt))
        : await db
            .select()
            .from(schema.apiKeys)
            .where(eq(schema.apiKeys.userId, Number(a.userID)))
            .orderBy(desc(schema.apiKeys.createdAt));
    return {
      keys: rows.map((r) => ({
        id: r.id,
        name: r.name,
        keyPrefix: r.keyPrefix,
        enabled: r.enabled,
        lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  },
);

interface KeyIdParam {
  id: number;
}

interface ToggleKeyRequest {
  id: number;
  enabled: boolean;
}

export const setKeyEnabled = api(
  { expose: true, auth: true, method: "PATCH", path: "/keys/:id" },
  async (p: ToggleKeyRequest): Promise<{ ok: boolean }> => {
    await authorizeKeyAccess(p.id);
    await db.update(schema.apiKeys).set({ enabled: p.enabled }).where(eq(schema.apiKeys.id, p.id));
    return { ok: true };
  },
);

export const deleteKey = api(
  { expose: true, auth: true, method: "DELETE", path: "/keys/:id" },
  async (p: KeyIdParam): Promise<{ ok: boolean }> => {
    await authorizeKeyAccess(p.id);
    await db.delete(schema.apiKeys).where(eq(schema.apiKeys.id, p.id));
    return { ok: true };
  },
);

interface RevealKeyResponse {
  key: string;
}

// Re-fetch the full plaintext SK by decrypting the stored ciphertext.
// Owner (or admin) only. Returns 404 for legacy keys with no ciphertext.
export const revealKey = api(
  { expose: true, auth: true, method: "GET", path: "/keys/:id/reveal" },
  async (p: KeyIdParam): Promise<RevealKeyResponse> => {
    await authorizeKeyAccess(p.id);
    const [row] = await db
      .select({ encryptedKey: schema.apiKeys.encryptedKey })
      .from(schema.apiKeys)
      .where(eq(schema.apiKeys.id, p.id))
      .limit(1);
    if (!row?.encryptedKey) {
      throw APIError.notFound("key value is not recoverable (created before reversible storage)");
    }
    const key = decryptSecret(row.encryptedKey, keyEncryptionKey());
    if (!key) throw APIError.internal("failed to decrypt key");
    return { key };
  },
);

async function authorizeKeyAccess(id: number): Promise<void> {
  const a = getAuthData()!;
  const [row] = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.id, id)).limit(1);
  if (!row) throw APIError.notFound("key not found");
  if (a.role !== "admin" && row.userId !== Number(a.userID)) {
    throw APIError.permissionDenied("not your key");
  }
}

// Internal: verify a raw SK and return the api key row id, or null if invalid/disabled.
// Used by the proxy service.
export interface VerifiedKey {
  id: number;
  userId: number;
}

export async function verifyApiKey(rawKey: string): Promise<VerifiedKey | null> {
  if (!rawKey) return null;
  const hash = sha256(rawKey);
  const [row] = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.keyHash, hash)).limit(1);
  if (!row || !row.enabled) return null;
  await db
    .update(schema.apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiKeys.id, row.id));
  return { id: row.id, userId: row.userId };
}
