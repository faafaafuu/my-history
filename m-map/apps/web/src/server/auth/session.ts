import { and, eq, gt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, schema } from "../db";
import { cookieSecure, env } from "../env";
import { HttpError } from "../http";
import { checkPassword, DUMMY_HASH, newApiToken, newSessionToken, sha256 } from "./password";

export const SESSION_COOKIE = "mm_session";

export type User = { id: string; email: string; name: string };

/* ── Вход ─────────────────────────────────────────────────────────────────── */

export async function verifyCredentials(email: string, password: string): Promise<User> {
  const [row] = await db()
    .select()
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = lower(${email.trim()})`)
    .limit(1);
  const ok = await checkPassword(password, row?.pass ?? DUMMY_HASH);
  if (!row || !ok) throw new HttpError(401, "Неверная почта или пароль.");
  return { id: row.id, email: row.email, name: row.name };
}

export async function openSession(userId: string): Promise<string> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + env().SESSION_DAYS * 86_400_000);
  await db().insert(schema.sessions).values({ hash: sha256(token), userId, expiresAt });
  return token;
}

export function sessionCookie(token: string, maxAge = env().SESSION_DAYS * 86_400) {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    cookieSecure() ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export async function closeSession(token: string | undefined) {
  if (token) await db().delete(schema.sessions).where(eq(schema.sessions.hash, sha256(token)));
}

/** Ключ для iOS/приложений. Старый ключ с тем же label уступает новому. */
export async function issueApiToken(userId: string, label: string): Promise<string> {
  const token = newApiToken();
  await db().transaction(async (tx) => {
    await tx.delete(schema.apiTokens).where(and(eq(schema.apiTokens.userId, userId), eq(schema.apiTokens.label, label)));
    await tx.insert(schema.apiTokens).values({ userId, label, hash: sha256(token) });
  });
  return token;
}

/* ── Кто это ──────────────────────────────────────────────────────────────── */

async function userBySession(token: string): Promise<User | null> {
  const [row] = await db()
    .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.hash, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

async function userByApiToken(token: string): Promise<User | null> {
  const [row] = await db()
    .update(schema.apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiTokens.hash, sha256(token)))
    .returning({ userId: schema.apiTokens.userId });
  if (!row) return null;
  const [user] = await db()
    .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.id, row.userId));
  return user ?? null;
}

function cookieFrom(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const at = part.indexOf("=");
    if (at > 0 && part.slice(0, at).trim() === name) return decodeURIComponent(part.slice(at + 1).trim());
  }
  return undefined;
}

export const sessionTokenOf = (req: Request) => cookieFrom(req, SESSION_COOKIE);

/** API: Bearer `mm_…` (приложения) или cookie сессии (браузер). */
export async function userFromRequest(req: Request): Promise<User | null> {
  const bearer = /^Bearer\s+(mm_[A-Za-z0-9_-]{20,})$/.exec(req.headers.get("authorization") ?? "");
  if (bearer?.[1]) return userByApiToken(bearer[1]);
  const token = sessionTokenOf(req);
  return token ? userBySession(token) : null;
}

export async function requireUser(req: Request): Promise<User> {
  const user = await userFromRequest(req);
  if (!user) throw new HttpError(401, "Нужен вход.");
  return user;
}

/** Серверные компоненты: пользователь по cookie. */
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? userBySession(token) : null;
}
