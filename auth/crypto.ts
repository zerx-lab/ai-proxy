import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHmac,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";

// --- Password hashing (scrypt, no native deps) ---

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const derived = scryptSync(password, salt, expected.length);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

// --- JWT (HS256, no external lib) ---

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export interface JwtPayload {
  sub: number; // user id
  role: string;
  exp: number; // unix seconds
}

export function signJwt(payload: Omit<JwtPayload, "exp">, secret: string, ttlSeconds = 7 * 24 * 3600): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const full: JwtPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = b64url(JSON.stringify(full));
  const data = `${header}.${body}`;
  const sig = b64url(createHmac("sha256", secret).update(data).digest());
  return `${data}.${sig}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const data = `${parts[0]}.${parts[1]}`;
  const expectedSig = b64url(createHmac("sha256", secret).update(data).digest());
  const a = Buffer.from(expectedSig);
  const b = Buffer.from(parts[2]);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(parts[1]).toString("utf8")) as JwtPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// --- API key (SK) generation ---

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = randomBytes(24).toString("base64url");
  const key = `sk-${raw}`;
  const hash = sha256(key);
  const prefix = `${key.slice(0, 10)}...`;
  return { key, hash, prefix };
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

// --- Symmetric encryption (AES-256-GCM) for reversible secret storage ---
// Key derived from the app secret via sha256 -> 32 bytes. Output is
// "<iv_hex>:<tag_hex>:<ciphertext_hex>". Tamper-evident via the GCM auth tag.

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest(); // 32 bytes
}

export function encryptSecret(plaintext: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(payload: string, secret: string): string | null {
  const parts = payload.split(":");
  if (parts.length !== 3) return null;
  try {
    const [ivHex, tagHex, dataHex] = parts;
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}
