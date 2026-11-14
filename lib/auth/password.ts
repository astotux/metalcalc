import crypto from "node:crypto";

const SCRYPT_KEY_LENGTH = 64;
const DEV_FALLBACK_SECRET = crypto
  .createHash("sha256")
  .update(`metalcalc-local-auth:${process.cwd()}`)
  .digest("hex");

export function getAuthSecret(): string {
  return process.env.AUTH_SECRET?.trim() || DEV_FALLBACK_SECRET;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) return false;
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;

  const expectedBuf = Buffer.from(expectedHex, "hex");
  const actualBuf = crypto.scryptSync(password, salt, expectedBuf.length);
  if (actualBuf.length !== expectedBuf.length) return false;

  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function hashVerificationCode(email: string, code: string): string {
  return crypto
    .createHmac("sha256", getAuthSecret())
    .update(`${email.trim().toLowerCase()}:${code.trim()}`)
    .digest("hex");
}
