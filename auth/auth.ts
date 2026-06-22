import { api, APIError, Gateway, Header } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { secret } from "encore.dev/config";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/db";
import { hashPassword, verifyPassword, signJwt, verifyJwt } from "./crypto";
import { getAuthData } from "~encore/auth";

const jwtSecret = secret("JWTSecret");

interface AuthParams {
  authorization: Header<"Authorization">;
}

export interface AuthData {
  userID: string;
  role: string;
}

export const auth = authHandler<AuthParams, AuthData>(async (params) => {
  const raw = params.authorization ?? "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;
  if (!token) throw APIError.unauthenticated("missing token");
  const payload = verifyJwt(token, jwtSecret());
  if (!payload) throw APIError.unauthenticated("invalid or expired token");
  return { userID: String(payload.sub), role: payload.role };
});

export const gateway = new Gateway({ authHandler: auth });

// --- Signup / Login ---

interface Credentials {
  email: string;
  password: string;
}

interface AuthResponse {
  token: string;
  user: { id: number; email: string; role: string };
}

// First registered user becomes admin; subsequent users are regular users.
export const signup = api(
  { expose: true, method: "POST", path: "/auth/signup" },
  async (p: Credentials): Promise<AuthResponse> => {
    const email = p.email.trim().toLowerCase();
    if (!email || !p.password || p.password.length < 6) {
      throw APIError.invalidArgument("email required and password >= 6 chars");
    }
    const existing = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (existing.length > 0) throw APIError.alreadyExists("email already registered");

    const countRows = await db.select({ id: schema.users.id }).from(schema.users);
    const role = countRows.length === 0 ? "admin" : "user";

    const [user] = await db
      .insert(schema.users)
      .values({ email, passwordHash: hashPassword(p.password), role })
      .returning();

    const token = signJwt({ sub: user.id, role: user.role }, jwtSecret());
    return { token, user: { id: user.id, email: user.email, role: user.role } };
  },
);

export const login = api(
  { expose: true, method: "POST", path: "/auth/login" },
  async (p: Credentials): Promise<AuthResponse> => {
    const email = p.email.trim().toLowerCase();
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (!user || !verifyPassword(p.password, user.passwordHash)) {
      throw APIError.unauthenticated("invalid credentials");
    }
    const token = signJwt({ sub: user.id, role: user.role }, jwtSecret());
    return { token, user: { id: user.id, email: user.email, role: user.role } };
  },
);

interface MeResponse {
  id: number;
  email: string;
  role: string;
}

export const me = api(
  { expose: true, auth: true, method: "GET", path: "/auth/me" },
  async (): Promise<MeResponse> => {
    const a = getAuthData()!;
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, Number(a.userID)))
      .limit(1);
    if (!user) throw APIError.notFound("user not found");
    return { id: user.id, email: user.email, role: user.role };
  },
);
