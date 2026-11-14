import { EXAMPLE_PROFILES } from "@/features/profiles/defaults";
import { createExampleProject } from "@/features/projects/defaults";
import { calculateProjectEstimate } from "@/lib/calculations/estimate";
import { getDatabase } from "@/lib/db/sqlite";
import type { CurrencyCode, MaterialProfile, MetalCalcProject, ProfileShapeType } from "@/types";

export class ProjectForbiddenError extends Error {
  constructor(message = "Нет прав доступа к этому проекту.") {
    super(message);
    this.name = "ProjectForbiddenError";
  }
}

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

/** При первом обращении создаёт персональный стартовый пример и каталог профилей для пользователя (или общие для системного режима без userId). */
function ensureSeeded(ownerUserId?: string | null): void {
  const db = getDatabase();
  const normalizedUserId = ownerUserId ?? null;

  if (normalizedUserId) {
    const countRow = db
      .prepare("SELECT COUNT(*) as cnt FROM projects WHERE user_id = ?")
      .get(normalizedUserId) as { cnt: number };

    if (countRow.cnt === 0) {
      const example = createExampleProject();
      example.id = `proj-example-${normalizedUserId}`;
      saveProjectToDb(example, normalizedUserId);
    }

    const catRow = db
      .prepare("SELECT user_id FROM user_profile_catalogs WHERE user_id = ?")
      .get(normalizedUserId) as { user_id: string } | undefined;

    if (!catRow) {
      saveCatalogProfilesToDb(EXAMPLE_PROFILES, normalizedUserId);
    }
    return;
  }

  const countRow = db
    .prepare("SELECT COUNT(*) as cnt FROM projects WHERE user_id IS NULL")
    .get() as { cnt: number };

  if (countRow.cnt === 0) {
    const example = createExampleProject();
    saveProjectToDb(example, null);
  }

  const catCountRow = db
    .prepare("SELECT COUNT(*) as cnt FROM profile_catalog")
    .get() as { cnt: number };

  if (catCountRow.cnt === 0) {
    saveCatalogProfilesToDb(EXAMPLE_PROFILES, null);
  }
}

export function listProjectsFromDb(viewerUserId?: string | null): DbProjectSummary[] {
  const normalizedUserId = viewerUserId ?? null;
  ensureSeeded(normalizedUserId);
  const db = getDatabase();
  const query = normalizedUserId
    ? `SELECT id, name, description, is_example, element_count, total_length_mm, total_cost, currency, created_at, updated_at
       FROM projects
       WHERE user_id = ?
       ORDER BY updated_at DESC`
    : `SELECT id, name, description, is_example, element_count, total_length_mm, total_cost, currency, created_at, updated_at
       FROM projects
       WHERE user_id IS NULL
       ORDER BY updated_at DESC`;

  const stmt = db.prepare(query);
  const rows = (normalizedUserId ? stmt.all(normalizedUserId) : stmt.all()) as Array<{
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

export function getProjectFromDb(
  id: string,
  viewerUserId?: string | null
): MetalCalcProject | null {
  const normalizedUserId = viewerUserId ?? null;
  ensureSeeded(normalizedUserId);
  const db = getDatabase();
  const row = db
    .prepare("SELECT data_json, user_id FROM projects WHERE id = ?")
    .get(id) as { data_json: string; user_id: string | null } | undefined;

  if (!row) return null;
  if ((row.user_id ?? null) !== normalizedUserId) {
    return null;
  }

  try {
    return JSON.parse(row.data_json) as MetalCalcProject;
  } catch {
    return null;
  }
}

export function saveProjectToDb(
  project: MetalCalcProject,
  ownerUserId?: string | null
): MetalCalcProject {
  const db = getDatabase();
  const normalizedUserId = ownerUserId ?? null;
  const now = new Date().toISOString();
  const normalized: MetalCalcProject = {
    ...project,
    createdAt: project.createdAt || now,
    updatedAt: now,
  };

  const existingOwner = db
    .prepare("SELECT user_id FROM projects WHERE id = ?")
    .get(normalized.id) as { user_id: string | null } | undefined;

  if (existingOwner && (existingOwner.user_id ?? null) !== normalizedUserId) {
    throw new ProjectForbiddenError("Нет прав доступа на изменение чужого проекта.");
  }

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
      created_at, updated_at, user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    normalized.updatedAt,
    normalizedUserId
  );

  return normalized;
}

export function renameProjectInDb(
  id: string,
  name: string,
  viewerUserId?: string | null
): MetalCalcProject | null {
  const normalizedUserId = viewerUserId ?? null;
  const existing = getProjectFromDb(id, normalizedUserId);
  if (!existing) return null;
  const trimmed = name.trim() || "Без названия";
  return saveProjectToDb(
    {
      ...existing,
      name: trimmed,
      isExample: false,
    },
    normalizedUserId
  );
}

export function duplicateProjectInDb(
  id: string,
  newName?: string,
  viewerUserId?: string | null
): MetalCalcProject | null {
  const normalizedUserId = viewerUserId ?? null;
  const existing = getProjectFromDb(id, normalizedUserId);
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
  return saveProjectToDb(copy, normalizedUserId);
}

export function deleteProjectInDb(
  id: string,
  viewerUserId?: string | null
): boolean {
  const normalizedUserId = viewerUserId ?? null;
  const existing = getProjectFromDb(id, normalizedUserId);
  if (!existing) return false;
  const db = getDatabase();
  const res = normalizedUserId
    ? db
        .prepare("DELETE FROM projects WHERE id = ? AND user_id = ?")
        .run(id, normalizedUserId)
    : db
        .prepare("DELETE FROM projects WHERE id = ? AND user_id IS NULL")
        .run(id);
  return Number(res.changes) > 0;
}

export function listCatalogProfilesFromDb(
  ownerUserId?: string | null
): MaterialProfile[] {
  const normalizedUserId = ownerUserId ?? null;
  ensureSeeded(normalizedUserId);
  const db = getDatabase();

  if (normalizedUserId) {
    const row = db
      .prepare("SELECT profiles_json FROM user_profile_catalogs WHERE user_id = ?")
      .get(normalizedUserId) as { profiles_json: string } | undefined;

    if (!row) {
      return EXAMPLE_PROFILES.map((p) => ({ ...p }));
    }
    try {
      return JSON.parse(row.profiles_json) as MaterialProfile[];
    } catch {
      return EXAMPLE_PROFILES.map((p) => ({ ...p }));
    }
  }

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

export function saveCatalogProfilesToDb(
  profiles: MaterialProfile[],
  ownerUserId?: string | null
): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  const normalizedUserId = ownerUserId ?? null;

  if (normalizedUserId) {
    db.prepare(
      `INSERT INTO user_profile_catalogs (user_id, profiles_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         profiles_json = excluded.profiles_json,
         updated_at = excluded.updated_at`
    ).run(normalizedUserId, JSON.stringify(profiles), now);
    return;
  }

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
