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
  `);
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
