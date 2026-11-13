import { EXAMPLE_PROFILES } from "@/features/profiles/defaults";
import type { CalculationSettings, DisplaySettings, GridSettings, MetalCalcProject } from "@/types";

export const DEFAULT_CALCULATION_SETTINGS: CalculationSettings = {
  currency: "RUB",
  paintingPricePerMeter: 120,
  weldPricingMode: "per_joint",
  weldPricePerMeter: 600,
  weldPricePerJoint: 150,
};

export const DEFAULT_GRID_SETTINGS: GridSettings = {
  majorStepMm: 500,
  minorStepMm: 100,
  snapEnabled: true,
  snapToGrid: true,
  snapToEndpoints: true,
  snapToIntersections: true,
  snapToAngles: true,
  showGrid: true,
  showAxes: true,
  showDimensions: true,
};

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  viewMode: "2d",
  cameraPreset: "isometric",
  zoomPercent: 100,
  panOffsetMm: { x: 0, y: 0 },
  showJoints: true,
  showProfileColors: true,
};

/** Создаёт новый чистый проект без элементов, но с набором примерных профилей. */
export function createEmptyProject(name = "Новый проект"): MetalCalcProject {
  const now = new Date().toISOString();
  return {
    id: `proj-${Date.now()}`,
    name,
    description: "Рабочий проект металлоконструкции",
    isExample: false,
    elements: [],
    groups: [],
    profiles: EXAMPLE_PROFILES.map((p) => ({ ...p })),
    joints: [],
    calculationSettings: { ...DEFAULT_CALCULATION_SETTINGS },
    gridSettings: { ...DEFAULT_GRID_SETTINGS },
    displaySettings: {
      ...DEFAULT_DISPLAY_SETTINGS,
      panOffsetMm: { ...DEFAULT_DISPLAY_SETTINGS.panOffsetMm },
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Создаёт демонстрационный проект-пример (рама верстака 1200×600 мм),
 * чтобы пользователь сразу увидел единую модель в работе, смету и панели редактора.
 */
export function createExampleProject(): MetalCalcProject {
  const now = new Date().toISOString();
  return {
    id: "proj-example-frame",
    name: "Пример: Рама стола 1200×600",
    description: "Демонстрационная конструкция с примерными ценами",
    isExample: true,
    elements: [
      {
        id: "el-1",
        type: "beam",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1200, y: 0, z: 0 },
        profileId: "prof-40x40x2",
        label: "Передняя балка",
      },
      {
        id: "el-2",
        type: "beam",
        start: { x: 1200, y: 0, z: 0 },
        end: { x: 1200, y: 600, z: 0 },
        profileId: "prof-40x40x2",
        label: "Правая перекладина",
      },
      {
        id: "el-3",
        type: "beam",
        start: { x: 1200, y: 600, z: 0 },
        end: { x: 0, y: 600, z: 0 },
        profileId: "prof-40x40x2",
        label: "Задняя балка",
      },
      {
        id: "el-4",
        type: "beam",
        start: { x: 0, y: 600, z: 0 },
        end: { x: 0, y: 0, z: 0 },
        profileId: "prof-40x40x2",
        label: "Левая перекладина",
      },
      {
        id: "el-5",
        type: "beam",
        start: { x: 600, y: 0, z: 0 },
        end: { x: 600, y: 600, z: 0 },
        profileId: "prof-40x20x2",
        label: "Среднее ребро жёсткости",
      },
    ],
    groups: [],
    profiles: EXAMPLE_PROFILES.map((p) => ({ ...p })),
    joints: [
      {
        id: "j-1",
        type: "miter_90",
        elementIds: ["el-1", "el-4"],
        position: { x: 0, y: 0, z: 0 },
        weldLengthMm: 160,
        cutAngleDeg: 45,
      },
      {
        id: "j-2",
        type: "miter_90",
        elementIds: ["el-1", "el-2"],
        position: { x: 1200, y: 0, z: 0 },
        weldLengthMm: 160,
        cutAngleDeg: 45,
      },
      {
        id: "j-3",
        type: "miter_90",
        elementIds: ["el-2", "el-3"],
        position: { x: 1200, y: 600, z: 0 },
        weldLengthMm: 160,
        cutAngleDeg: 45,
      },
      {
        id: "j-4",
        type: "miter_90",
        elementIds: ["el-3", "el-4"],
        position: { x: 0, y: 600, z: 0 },
        weldLengthMm: 160,
        cutAngleDeg: 45,
      },
      {
        id: "j-5",
        type: "t_joint",
        elementIds: ["el-1", "el-5"],
        position: { x: 600, y: 0, z: 0 },
        weldLengthMm: 120,
      },
      {
        id: "j-6",
        type: "t_joint",
        elementIds: ["el-3", "el-5"],
        position: { x: 600, y: 600, z: 0 },
        weldLengthMm: 120,
      },
    ],
    calculationSettings: { ...DEFAULT_CALCULATION_SETTINGS },
    gridSettings: { ...DEFAULT_GRID_SETTINGS },
    displaySettings: {
      ...DEFAULT_DISPLAY_SETTINGS,
      panOffsetMm: { ...DEFAULT_DISPLAY_SETTINGS.panOffsetMm },
    },
    createdAt: now,
    updatedAt: now,
  };
}
