import crypto from "node:crypto";
import { getDatabase } from "@/lib/db/sqlite";
import { hashVerificationCode } from "@/lib/auth/password";
import type { OAuthUserProfile } from "@/lib/auth/oauth";
import type { AuthProviderType, AuthUser } from "@/types";

export const VERIFICATION_CODE_TTL_MS = 1000 * 60 * 10; // 10 минут
export const VERIFICATION_RESEND_COOLDOWN_MS = 1000 * 45; // 45 секунд
export const VERIFICATION_MAX_ATTEMPTS = 5;

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  email_verified: number;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbUserWithPassword extends AuthUser {
  passwordHash: string | null;
}

function listProvidersForUser(userId: string, hasPassword: boolean): AuthProviderType[] {
  const db = getDatabase();
  const oauthRows = db
    .prepare("SELECT provider FROM oauth_accounts WHERE user_id = ?")
    .all(userId) as Array<{ provider: "yandex" | "vk" }>;

  const providers: AuthProviderType[] = [];
  if (hasPassword) {
    providers.push("email");
  }
  for (const row of oauthRows) {
    if (!providers.includes(row.provider)) {
      providers.push(row.provider);
    }
  }
  return providers;
}

function mapUserRow(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url ?? undefined,
    emailVerified: Boolean(row.email_verified),
    providers: listProvidersForUser(row.id, Boolean(row.password_hash)),
    createdAt: row.created_at,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function findUserByEmail(email: string): DbUserWithPassword | null {
  const db = getDatabase();
  const row = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(normalizeEmail(email)) as UserRow | undefined;
  if (!row) return null;
  return {
    ...mapUserRow(row),
    passwordHash: row.password_hash,
  };
}

export function findUserById(userId: string): AuthUser | null {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as UserRow | undefined;
  return row ? mapUserRow(row) : null;
}

export function upsertPendingEmailUser(params: {
  email: string;
  name: string;
  passwordHash: string;
}): { user: AuthUser; alreadyVerified: boolean } {
  const db = getDatabase();
  const normalized = normalizeEmail(params.email);
  const existing = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(normalized) as UserRow | undefined;

  const now = new Date().toISOString();

  if (existing) {
    if (existing.email_verified) {
      return {
        user: mapUserRow(existing),
        alreadyVerified: true,
      };
    }

    db.prepare(
      `UPDATE users
       SET name = ?, password_hash = ?, updated_at = ?
       WHERE id = ?`
    ).run(params.name.trim(), params.passwordHash, now, existing.id);

    const updated = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(existing.id) as unknown as UserRow;
    return {
      user: mapUserRow(updated),
      alreadyVerified: false,
    };
  }

  const id = `usr-${crypto.randomUUID()}`;
  db.prepare(
    `INSERT INTO users (id, email, name, password_hash, email_verified, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`
  ).run(id, normalized, params.name.trim(), params.passwordHash, now, now);

  const created = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(id) as unknown as UserRow;
  return {
    user: mapUserRow(created),
    alreadyVerified: false,
  };
}

export function getVerificationResendCooldownSeconds(email: string): number {
  const db = getDatabase();
  const normalized = normalizeEmail(email);
  const latest = db
    .prepare(
      `SELECT created_at
       FROM email_verification_codes
       WHERE email = ? AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(normalized) as { created_at: string } | undefined;

  if (!latest) return 0;
  const elapsedMs = Date.now() - new Date(latest.created_at).getTime();
  if (elapsedMs >= VERIFICATION_RESEND_COOLDOWN_MS) return 0;
  return Math.ceil((VERIFICATION_RESEND_COOLDOWN_MS - elapsedMs) / 1000);
}

export function saveEmailVerificationCode(params: {
  email: string;
  userId: string;
  code: string;
}): void {
  const db = getDatabase();
  const normalized = normalizeEmail(params.email);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS).toISOString();
  const codeHash = hashVerificationCode(normalized, params.code);

  // Аннулируем предыдущие неиспользованные коды для этой почты
  db.prepare(
    `UPDATE email_verification_codes
     SET consumed_at = ?
     WHERE email = ? AND consumed_at IS NULL`
  ).run(now, normalized);

  db.prepare(
    `INSERT INTO email_verification_codes (
      id, email, user_id, code_hash, expires_at, attempts, created_at
    ) VALUES (?, ?, ?, ?, ?, 0, ?)`
  ).run(`evc-${crypto.randomUUID()}`, normalized, params.userId, codeHash, expiresAt, now);
}

export type VerifyCodeResult =
  | { ok: true; user: AuthUser }
  | { ok: false; reason: "not_found" | "expired" | "too_many_attempts" | "invalid"; attemptsLeft?: number };

export function verifyEmailCodeInDb(email: string, code: string): VerifyCodeResult {
  const db = getDatabase();
  const normalized = normalizeEmail(email);
  const row = db
    .prepare(
      `SELECT * FROM email_verification_codes
       WHERE email = ? AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(normalized) as
    | {
        id: string;
        email: string;
        user_id: string | null;
        code_hash: string;
        expires_at: string;
        attempts: number;
      }
    | undefined;

  if (!row) {
    return { ok: false, reason: "not_found" };
  }

  if (Date.now() > new Date(row.expires_at).getTime()) {
    return { ok: false, reason: "expired" };
  }

  if (row.attempts >= VERIFICATION_MAX_ATTEMPTS) {
    return { ok: false, reason: "too_many_attempts" };
  }

  const expectedHash = Buffer.from(row.code_hash, "hex");
  const actualHash = Buffer.from(hashVerificationCode(normalized, code), "hex");
  const isMatch =
    expectedHash.length === actualHash.length &&
    crypto.timingSafeEqual(expectedHash, actualHash);

  if (!isMatch) {
    const nextAttempts = row.attempts + 1;
    db.prepare("UPDATE email_verification_codes SET attempts = ? WHERE id = ?").run(
      nextAttempts,
      row.id
    );
    return {
      ok: false,
      reason: nextAttempts >= VERIFICATION_MAX_ATTEMPTS ? "too_many_attempts" : "invalid",
      attemptsLeft: Math.max(0, VERIFICATION_MAX_ATTEMPTS - nextAttempts),
    };
  }

  const now = new Date().toISOString();
  db.exec("BEGIN");
  try {
    db.prepare("UPDATE email_verification_codes SET consumed_at = ? WHERE id = ?").run(
      now,
      row.id
    );
    if (row.user_id) {
      db.prepare("UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?").run(
        now,
        row.user_id
      );
    } else {
      db.prepare("UPDATE users SET email_verified = 1, updated_at = ? WHERE email = ?").run(
        now,
        normalized
      );
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  const user = row.user_id ? findUserById(row.user_id) : findUserByEmail(normalized);
  if (!user) {
    return { ok: false, reason: "not_found" };
  }
  return { ok: true, user };
}

export function upsertOAuthUser(profile: OAuthUserProfile): AuthUser {
  const db = getDatabase();
  const now = new Date().toISOString();

  const existingOAuth = db
    .prepare(
      "SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?"
    )
    .get(profile.provider, profile.providerUserId) as { user_id: string } | undefined;

  if (existingOAuth) {
    const existingUser = findUserById(existingOAuth.user_id);
    if (existingUser) {
      if (profile.avatarUrl && !existingUser.avatarUrl) {
        db.prepare("UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?").run(
          profile.avatarUrl,
          now,
          existingUser.id
        );
      }
      return findUserById(existingUser.id) ?? existingUser;
    }
  }

  const normalizedEmail = profile.email ? normalizeEmail(profile.email) : null;
  const userByEmail = normalizedEmail
    ? (db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail) as UserRow | undefined)
    : undefined;

  if (userByEmail) {
    db.exec("BEGIN");
    try {
      db.prepare(
        `INSERT OR IGNORE INTO oauth_accounts (id, user_id, provider, provider_user_id, email, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        `oa-${crypto.randomUUID()}`,
        userByEmail.id,
        profile.provider,
        profile.providerUserId,
        normalizedEmail,
        now
      );

      db.prepare(
        `UPDATE users
         SET email_verified = CASE WHEN ? = 1 THEN 1 ELSE email_verified END,
             avatar_url = COALESCE(avatar_url, ?),
             updated_at = ?
         WHERE id = ?`
      ).run(profile.emailVerified ? 1 : 0, profile.avatarUrl ?? null, now, userByEmail.id);

      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }

    const updated = findUserById(userByEmail.id);
    if (!updated) throw new Error("Не удалось обновить пользователя OAuth.");
    return updated;
  }

  const userId = `usr-${crypto.randomUUID()}`;
  const fallbackEmail =
    normalizedEmail || `${profile.provider}_${profile.providerUserId}@${profile.provider}.oauth.local`;

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO users (id, email, name, password_hash, email_verified, avatar_url, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`
    ).run(
      userId,
      fallbackEmail,
      profile.name.trim() || "Пользователь",
      profile.emailVerified ? 1 : 0,
      profile.avatarUrl ?? null,
      now,
      now
    );

    db.prepare(
      `INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, email, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      `oa-${crypto.randomUUID()}`,
      userId,
      profile.provider,
      profile.providerUserId,
      normalizedEmail,
      now
    );
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  const created = findUserById(userId);
  if (!created) throw new Error("Не удалось создать пользователя OAuth.");
  return created;
}

export function createSessionInDb(params: {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
}): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  // Периодически очищаем просроченные сессии
  db.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").run(now);
  db.prepare(
    `INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(params.id, params.userId, params.tokenHash, params.expiresAt, now);
}

export function findSessionUserByTokenHash(tokenHash: string): AuthUser | null {
  const db = getDatabase();
  const sessionRow = db
    .prepare("SELECT user_id, expires_at FROM auth_sessions WHERE token_hash = ?")
    .get(tokenHash) as { user_id: string; expires_at: string } | undefined;

  if (!sessionRow) return null;
  if (Date.now() > new Date(sessionRow.expires_at).getTime()) {
    db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(tokenHash);
    return null;
  }
  return findUserById(sessionRow.user_id);
}

export function deleteSessionByTokenHash(tokenHash: string): void {
  const db = getDatabase();
  db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(tokenHash);
}
