import { EXAMPLE_PROFILES } from "@/features/profiles/defaults";
import { createExampleProject } from "@/features/projects/defaults";
import { calculateProjectEstimate } from "@/lib/calculations/estimate";
import { getDatabase } from "@/lib/db/sqlite";
import type { CurrencyCode, MaterialProfile, MetalCalcProject, ProfileShapeType } from "@/types";

export interface DbProjectSummary {
  id: string;
  name: string;
  description?: string;
  isExample: boolean;
  elementCount: number;
  totalLengthMm: number;
  totalCost: number;
  currency: CurrencyCode;
  createdAt: string;
  updatedAt: string;
}

/** При первом обращении к пустой БД создаёт демонстрационный проект-пример и базовый каталог. */
function ensureSeeded(): void {
  const db = getDatabase();

  const countRow = db
    .prepare("SELECT COUNT(*) as cnt FROM projects")
    .get() as { cnt: number };

  if (countRow.cnt === 0) {
    const example = createExampleProject();
    saveProjectToDb(example);
  }

  const catCountRow = db
    .prepare("SELECT COUNT(*) as cnt FROM profile_catalog")
    .get() as { cnt: number };

  if (catCountRow.cnt === 0) {
    saveCatalogProfilesToDb(EXAMPLE_PROFILES);
  }
}

export function listProjectsFromDb(): DbProjectSummary[] {
  ensureSeeded();
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT id, name, description, is_example, element_count, total_length_mm, total_cost, currency, created_at, updated_at
       FROM projects
       ORDER BY updated_at DESC`
    )
    .all() as Array<{
    id: string;
    name: string;
    description: string | null;
    is_example: number;
    element_count: number;
    total_length_mm: number;
    total_cost: number;
    currency: CurrencyCode;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    isExample: Boolean(row.is_example),
    elementCount: row.element_count,
    totalLengthMm: row.total_length_mm,
    totalCost: row.total_cost,
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function getProjectFromDb(id: string): MetalCalcProject | null {
  ensureSeeded();
  const db = getDatabase();
  const row = db
    .prepare("SELECT data_json FROM projects WHERE id = ?")
    .get(id) as { data_json: string } | undefined;

  if (!row) return null;
  try {
    return JSON.parse(row.data_json) as MetalCalcProject;
  } catch {
    return null;
  }
}

export function saveProjectToDb(project: MetalCalcProject): MetalCalcProject {
  const db = getDatabase();
  const now = new Date().toISOString();
  const normalized: MetalCalcProject = {
    ...project,
    createdAt: project.createdAt || now,
    updatedAt: now,
  };

  const estimate = calculateProjectEstimate(
    normalized.elements,
    normalized.profiles,
    normalized.joints,
    normalized.calculationSettings
  );

  db.prepare(
    `INSERT INTO projects (
      id, name, description, is_example, data_json,
      element_count, total_length_mm, total_cost, currency,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      is_example = excluded.is_example,
      data_json = excluded.data_json,
      element_count = excluded.element_count,
      total_length_mm = excluded.total_length_mm,
      total_cost = excluded.total_cost,
      currency = excluded.currency,
      updated_at = excluded.updated_at`
  ).run(
    normalized.id,
    normalized.name,
    normalized.description ?? null,
    normalized.isExample ? 1 : 0,
    JSON.stringify(normalized),
    estimate.elementCount,
    estimate.totalLengthMm,
    estimate.totalCost,
    estimate.currency,
    normalized.createdAt,
    normalized.updatedAt
  );

  return normalized;
}

export function renameProjectInDb(id: string, name: string): MetalCalcProject | null {
  const existing = getProjectFromDb(id);
  if (!existing) return null;
  const trimmed = name.trim() || "Без названия";
  return saveProjectToDb({
    ...existing,
    name: trimmed,
    isExample: false,
  });
}

export function duplicateProjectInDb(
  id: string,
  newName?: string
): MetalCalcProject | null {
  const existing = getProjectFromDb(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const copy: MetalCalcProject = {
    ...existing,
    id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: newName?.trim() || `${existing.name} (копия)`,
    isExample: false,
    createdAt: now,
    updatedAt: now,
  };
  return saveProjectToDb(copy);
}

export function deleteProjectInDb(id: string): boolean {
  const db = getDatabase();
  const res = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  return Number(res.changes) > 0;
}

export function listCatalogProfilesFromDb(): MaterialProfile[] {
  ensureSeeded();
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT id, name, shape_type, width_mm, height_mm, wall_thickness_mm, price_per_meter, color, description, is_example
       FROM profile_catalog`
    )
    .all() as Array<{
    id: string;
    name: string;
    shape_type: ProfileShapeType;
    width_mm: number;
    height_mm: number;
    wall_thickness_mm: number;
    price_per_meter: number;
    color: string;
    description: string | null;
    is_example: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    shapeType: r.shape_type,
    widthMm: r.width_mm,
    heightMm: r.height_mm,
    wallThicknessMm: r.wall_thickness_mm,
    pricePerMeter: r.price_per_meter,
    color: r.color,
    description: r.description ?? undefined,
    isExample: Boolean(r.is_example),
  }));
}

export function saveCatalogProfilesToDb(profiles: MaterialProfile[]): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM profile_catalog");
    const stmt = db.prepare(
      `INSERT INTO profile_catalog (
        id, name, shape_type, width_mm, height_mm, wall_thickness_mm,
        price_per_meter, color, description, is_example, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const p of profiles) {
      stmt.run(
        p.id,
        p.name,
        p.shapeType,
        p.widthMm,
        p.heightMm,
        p.wallThicknessMm,
        p.pricePerMeter,
        p.color,
        p.description ?? null,
        p.isExample ? 1 : 0,
        now
      );
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
