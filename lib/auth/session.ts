import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createSessionInDb,
  deleteSessionByTokenHash,
  findSessionUserByTokenHash,
} from "@/lib/db/usersRepository";
import { hashToken } from "@/lib/auth/password";
import type { AuthUser } from "@/types";

export const SESSION_COOKIE_NAME = "mc_session";
const SHORT_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 дней
const LONG_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 дней

export interface IssuedSession {
  rawToken: string;
  expiresAt: string;
  maxAgeSeconds: number;
}

export function issueSessionForUser(
  userId: string,
  rememberMe = true
): IssuedSession {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const ttlMs = rememberMe ? LONG_SESSION_TTL_MS : SHORT_SESSION_TTL_MS;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  createSessionInDb({
    id: crypto.randomUUID(),
    userId,
    tokenHash,
    expiresAt,
  });

  return {
    rawToken,
    expiresAt,
    maxAgeSeconds: Math.floor(ttlMs / 1000),
  };
}

export function attachSessionCookie(
  response: NextResponse,
  session: IssuedSession
): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, session.rawToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: session.maxAgeSeconds,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return response;
}

export function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const eqIndex = part.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = part.slice(0, eqIndex).trim();
    const rawValue = part.slice(eqIndex + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(rawValue);
    } catch {
      result[key] = rawValue;
    }
  }
  return result;
}

export function getSessionTokenFromRequest(request: Request): string | null {
  const cookiesMap = parseCookieHeader(request.headers.get("cookie"));
  return cookiesMap[SESSION_COOKIE_NAME] || null;
}

export function getSessionUserFromRequest(request: Request): AuthUser | null {
  const token = getSessionTokenFromRequest(request);
  if (!token) return null;
  return findSessionUserByTokenHash(hashToken(token));
}

export async function getSessionUserFromCookies(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return findSessionUserByTokenHash(hashToken(token));
}

export function revokeSessionFromRequest(request: Request): void {
  const token = getSessionTokenFromRequest(request);
  if (!token) return;
  deleteSessionByTokenHash(hashToken(token));
}
