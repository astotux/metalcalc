import type { MaterialProfile, ProfileShapeMeta } from "@/types";

/** Справочник всех архитектурно поддерживаемых типов сечений. */
export const PROFILE_SHAPE_CATALOG: ProfileShapeMeta[] = [
  { type: "rectangular_tube", label: "Прямоугольная труба", implementedInMvp: true },
  { type: "square_tube", label: "Квадратная труба", implementedInMvp: true },
  { type: "round_tube", label: "Круглая труба", implementedInMvp: false },
  { type: "angle", label: "Уголок", implementedInMvp: false },
  { type: "channel", label: "Швеллер", implementedInMvp: false },
  { type: "i_beam", label: "Двутавр", implementedInMvp: false },
  { type: "strip", label: "Полоса", implementedInMvp: false },
  { type: "sheet", label: "Листовой металл", implementedInMvp: false },
];

/**
 * Демонстрационные профильные трубы и цены для первичного запуска.
 * Явно помечены флагом isExample = true, чтобы пользователь понимал,
 * что цены приведены как пример и их следует обновить под свой прайс.
 */
export const EXAMPLE_PROFILES: MaterialProfile[] = [
  {
    id: "prof-20x20x1_5",
    name: "Профиль 20×20×1.5",
    shapeType: "square_tube",
    widthMm: 20,
    heightMm: 20,
    wallThicknessMm: 1.5,
    pricePerMeter: 180,
    color: "#38bdf8",
    description: "Пример цены. Лёгкая квадратная труба для перемычек и обрешётки.",
    isExample: true,
  },
  {
    id: "prof-40x20x2",
    name: "Профиль 40×20×2",
    shapeType: "rectangular_tube",
    widthMm: 40,
    heightMm: 20,
    wallThicknessMm: 2,
    pricePerMeter: 350,
    color: "#34d399",
    description: "Пример цены. Прямоугольная труба для рам, ворот и каркасов.",
    isExample: true,
  },
  {
    id: "prof-40x40x2",
    name: "Профиль 40×40×2",
    shapeType: "square_tube",
    widthMm: 40,
    heightMm: 40,
    wallThicknessMm: 2,
    pricePerMeter: 450,
    color: "#f59e0b",
    description: "Пример цены. Универсальная несущая квадратная труба.",
    isExample: true,
  },
  {
    id: "prof-60x30x2",
    name: "Профиль 60×30×2",
    shapeType: "rectangular_tube",
    widthMm: 60,
    heightMm: 30,
    wallThicknessMm: 2,
    pricePerMeter: 500,
    color: "#a78bfa",
    description: "Пример цены. Усиленная балка для прогонов и перекрытий.",
    isExample: true,
  },
  {
    id: "prof-80x40x3",
    name: "Профиль 80×40×3",
    shapeType: "rectangular_tube",
    widthMm: 80,
    heightMm: 40,
    wallThicknessMm: 3,
    pricePerMeter: 890,
    color: "#fb7185",
    description: "Пример цены. Мощная несущая балка для ферм и опор.",
    isExample: true,
  },
];
