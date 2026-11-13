import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EXAMPLE_PROFILES } from "@/features/profiles/defaults";
import { createEmptyProject, createExampleProject } from "@/features/projects/defaults";
import { calculateProjectEstimate } from "@/lib/calculations/estimate";
import {
  deleteProjectInDb,
  duplicateProjectInDb,
  getProjectFromDb,
  listCatalogProfilesFromDb,
  listProjectsFromDb,
  renameProjectInDb,
  saveCatalogProfilesToDb,
  saveProjectToDb,
} from "@/lib/db/projectsRepository";
import { resetDatabaseForTests } from "@/lib/db/sqlite";
import { metalCalcProjectSchema } from "@/lib/validation/schemas";

describe("SQLite projects repository", () => {
  beforeEach(() => {
    process.env.METALCALC_DB_PATH = ":memory:";
    resetDatabaseForTests();
  });

  afterEach(() => {
    resetDatabaseForTests();
    delete process.env.METALCALC_DB_PATH;
  });

  it("seeds example project and catalog profiles on first read", () => {
    const projects = listProjectsFromDb();
    expect(projects.length).toBe(1);
    expect(projects[0].isExample).toBe(true);
    expect(projects[0].elementCount).toBeGreaterThan(0);
    expect(projects[0].totalLengthMm).toBeGreaterThan(0);
    expect(projects[0].totalCost).toBeGreaterThan(0);

    const profiles = listCatalogProfilesFromDb();
    expect(profiles.length).toBe(EXAMPLE_PROFILES.length);
  });

  it("saves, loads and validates full MetalCalcProject roundtrip", () => {
    const project = createExampleProject();
    project.id = "proj-custom-1";
    project.name = "Навес 6x4 тестовый";
    project.isExample = false;

    const saved = saveProjectToDb(project);
    const loaded = getProjectFromDb("proj-custom-1");
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe(saved.id);
    expect(loaded?.name).toBe("Навес 6x4 тестовый");
    expect(loaded?.elements.length).toBe(project.elements.length);
    expect(loaded?.joints.length).toBe(project.joints.length);
    expect(loaded?.calculationSettings).toEqual(project.calculationSettings);
    expect(loaded?.gridSettings).toEqual(project.gridSettings);
    expect(loaded?.displaySettings).toEqual(project.displaySettings);

    const parsed = metalCalcProjectSchema.safeParse(loaded);
    expect(parsed.success).toBe(true);

    const summary = listProjectsFromDb().find((item) => item.id === "proj-custom-1");
    const estimate = calculateProjectEstimate(
      project.elements,
      project.profiles,
      project.joints,
      project.calculationSettings
    );
    expect(summary?.totalLengthMm).toBe(estimate.totalLengthMm);
    expect(summary?.totalCost).toBe(estimate.totalCost);
  });

  it("renames, duplicates and deletes projects cleanly", () => {
    const empty = createEmptyProject("Каркас ворот");
    empty.id = "proj-gate";
    saveProjectToDb(empty);

    const renamed = renameProjectInDb("proj-gate", "Ворота откатные 4м");
    expect(renamed?.name).toBe("Ворота откатные 4м");
    expect(renamed?.isExample).toBe(false);

    const copy = duplicateProjectInDb("proj-gate", "Ворота (вариант 2)");
    expect(copy).not.toBeNull();
    expect(copy?.id).not.toBe("proj-gate");
    expect(copy?.name).toBe("Ворота (вариант 2)");

    expect(deleteProjectInDb("proj-gate")).toBe(true);
    expect(getProjectFromDb("proj-gate")).toBeNull();
    expect(getProjectFromDb(copy!.id)).not.toBeNull();
  });

  it("persists updated profile catalog in SQLite", () => {
    const customProfiles = [
      ...EXAMPLE_PROFILES,
      {
        id: "prof-custom-100",
        name: "Труба 100×100×4",
        shapeType: "square_tube" as const,
        widthMm: 100,
        heightMm: 100,
        wallThicknessMm: 4,
        pricePerMeter: 780,
        color: "#0ea5e9",
        description: "Силовая колонна",
        isExample: false,
      },
    ];

    saveCatalogProfilesToDb(customProfiles);
    const loaded = listCatalogProfilesFromDb();
    expect(loaded.length).toBe(customProfiles.length);
    expect(loaded.some((p) => p.id === "prof-custom-100" && p.pricePerMeter === 780)).toBe(true);
  });
});
