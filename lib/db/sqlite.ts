import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

let cachedDb: DatabaseSync | null = null;
let cachedDbPath: string | null = null;

function resolveDbPath(): string {
  if (process.env.METALCALC_DB_PATH) {
    return process.env.METALCALC_DB_PATH;
  }
  return path.join(process.cwd(), "data", "metalcalc.db");
}

function initSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      is_example INTEGER NOT NULL DEFAULT 0,
      data_json TEXT NOT NULL,
      element_count INTEGER NOT NULL DEFAULT 0,
      total_length_mm REAL NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'RUB',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profile_catalog (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      shape_type TEXT NOT NULL,
      width_mm REAL NOT NULL,
      height_mm REAL NOT NULL,
      wall_thickness_mm REAL NOT NULL,
      price_per_meter REAL NOT NULL,
      color TEXT NOT NULL,
      description TEXT,
      is_example INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      avatar_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS oauth_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      email TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(provider, provider_user_id)
    );

    CREATE TABLE IF NOT EXISTS email_verification_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      consumed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_email_codes_email_created
      ON email_verification_codes(email, created_at DESC);

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
      ON auth_sessions(user_id);

    CREATE TABLE IF NOT EXISTS user_profile_catalogs (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      profiles_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const projectColumns = db
    .prepare("PRAGMA table_info(projects)")
    .all() as Array<{ name: string }>;
  if (!projectColumns.some((col) => col.name === "user_id")) {
    db.exec("ALTER TABLE projects ADD COLUMN user_id TEXT");
  }
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, updated_at DESC);"
  );
}

/**
 * Возвращает экземпляр SQLite-базы (через встроенный в Node 24 модуль node:sqlite).
 * Для тестов поддерживает METALCALC_DB_PATH=":memory:" или временный файл.
 */
export function getDatabase(): DatabaseSync {
  const targetPath = resolveDbPath();

  if (cachedDb && cachedDbPath === targetPath) {
    return cachedDb;
  }

  if (targetPath !== ":memory:") {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(targetPath);
  initSchema(db);
  cachedDb = db;
  cachedDbPath = targetPath;
  return db;
}

/** Сбрасывает кешированное подключение (используется в тестах). */
export function resetDatabaseForTests(): void {
  if (cachedDb) {
    try {
      cachedDb.close();
    } catch {
      // ignore
    }
  }
  cachedDb = null;
  cachedDbPath = null;
}
