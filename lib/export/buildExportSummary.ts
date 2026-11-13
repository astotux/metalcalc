import {
  calculateProjectEstimate,
  formatMoney,
  formatProfileDimensions,
  roundMoney,
} from "@/lib/calculations/estimate";
import { getElementLengthMm, mmToMeters, roundMm } from "@/lib/geometry/elements";
import type { CostEstimate, MaterialProfile, MetalCalcProject } from "@/types";

export interface ExportMaterialRow {
  profileId: string;
  profileName: string;
  dimensionsLabel: string;
  wallThicknessMm: number;
  elementCount: number;
  totalLengthMm: number;
  totalLengthMeters: number;
  pricePerMeter: number;
  totalCost: number;
  color: string;
}

export interface ExportElementRow {
  index: number;
  id: string;
  name: string;
  profileName: string;
  dimensionsLabel: string;
  lengthMm: number;
  lengthMeters: number;
  startLabel: string;
  endLabel: string;
  excludeFromPainting: boolean;
  materialCost: number;
}

export interface ExportBoundsMm {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  widthMm: number;
  heightMm: number;
  depthMm: number;
}

export interface ProjectExportData {
  projectName: string;
  description?: string;
  isExample: boolean;
  exportedAtIso: string;
  exportedAtLabel: string;
  estimate: CostEstimate;
  materialRows: ExportMaterialRow[];
  elementRows: ExportElementRow[];
  boundsMm: ExportBoundsMm;
  workSummary: {
    paintingPricePerMeter: number;
    paintableLengthMeters: number;
    paintingCost: number;
    weldModeLabel: string;
    weldRate: number;
    jointCount: number;
    knownWeldLengthMeters: number;
    hasUnknownWeldLength: boolean;
    weldingCost: number;
  };
}

/** Собирает структурированные и проверенные данные проекта для экспорта в PDF и Excel. */
export function buildProjectExportData(project: MetalCalcProject): ProjectExportData {
  const estimate = calculateProjectEstimate(
    project.elements,
    project.profiles,
    project.joints,
    project.calculationSettings
  );

  const profileMap = new Map<string, MaterialProfile>();
  for (const profile of project.profiles) {
    profileMap.set(profile.id, profile);
  }

  const materialRows: ExportMaterialRow[] = estimate.profileItems.map((item) => ({
    profileId: item.profileId,
    profileName: item.profileName,
    dimensionsLabel: item.dimensionsLabel,
    wallThicknessMm: item.wallThicknessMm,
    elementCount: item.elementCount,
    totalLengthMm: item.totalLengthMm,
    totalLengthMeters: item.totalLengthMeters,
    pricePerMeter: item.pricePerMeter,
    totalCost: item.totalCost,
    color: item.color,
  }));

  const elementRows: ExportElementRow[] = project.elements.map((el, index) => {
    const profile = profileMap.get(el.profileId);
    const lengthMm = roundMm(getElementLengthMm(el));
    const lengthMeters = Math.round(mmToMeters(lengthMm) * 1000) / 1000;
    const pricePerMeter = profile?.pricePerMeter ?? 0;

    return {
      index: index + 1,
      id: el.id,
      name: el.label?.trim() || `Элемент #${index + 1}`,
      profileName: profile?.name ?? "Не указан",
      dimensionsLabel: profile ? formatProfileDimensions(profile) : "—",
      lengthMm,
      lengthMeters,
      startLabel: `${roundMm(el.start.x)}; ${roundMm(el.start.y)}; ${roundMm(el.start.z)}`,
      endLabel: `${roundMm(el.end.x)}; ${roundMm(el.end.y)}; ${roundMm(el.end.z)}`,
      excludeFromPainting: Boolean(el.excludeFromPainting),
      materialCost: roundMoney(mmToMeters(lengthMm) * pricePerMeter),
    };
  });

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const el of project.elements) {
    minX = Math.min(minX, el.start.x, el.end.x);
    maxX = Math.max(maxX, el.start.x, el.end.x);
    minY = Math.min(minY, el.start.y, el.end.y);
    maxY = Math.max(maxY, el.start.y, el.end.y);
    minZ = Math.min(minZ, el.start.z, el.end.z);
    maxZ = Math.max(maxZ, el.start.z, el.end.z);
  }

  const hasElements = project.elements.length > 0;
  const boundsMm: ExportBoundsMm = hasElements
    ? {
        minX: roundMm(minX),
        maxX: roundMm(maxX),
        minY: roundMm(minY),
        maxY: roundMm(maxY),
        minZ: roundMm(minZ),
        maxZ: roundMm(maxZ),
        widthMm: roundMm(maxX - minX),
        heightMm: roundMm(maxY - minY),
        depthMm: roundMm(maxZ - minZ),
      }
    : {
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
        minZ: 0,
        maxZ: 0,
        widthMm: 0,
        heightMm: 0,
        depthMm: 0,
      };

  const now = new Date();
  const isPerJoint = project.calculationSettings.weldPricingMode === "per_joint";

  return {
    projectName: project.name.trim() || "Без названия",
    description: project.description,
    isExample: project.isExample,
    exportedAtIso: now.toISOString(),
    exportedAtLabel: now.toLocaleString("ru-RU"),
    estimate,
    materialRows,
    elementRows,
    boundsMm,
    workSummary: {
      paintingPricePerMeter: project.calculationSettings.paintingPricePerMeter,
      paintableLengthMeters: estimate.paintableLengthMeters,
      paintingCost: estimate.paintingCost,
      weldModeLabel: isPerJoint ? "За 1 соединение" : "За 1 погонный метр шва",
      weldRate: isPerJoint
        ? project.calculationSettings.weldPricePerJoint
        : project.calculationSettings.weldPricePerMeter,
      jointCount: estimate.jointCount,
      knownWeldLengthMeters: estimate.knownWeldLengthMeters,
      hasUnknownWeldLength: estimate.hasUnknownWeldLength,
      weldingCost: estimate.weldingCost,
    },
  };
}

/** Формирует безопасное имя файла для скачивания. */
export function buildExportFileName(projectName: string, ext: "pdf" | "xlsx"): string {
  const normalized = (projectName || "metalcalc-project")
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${normalized || "metalcalc-project"}_smeta.${ext}`;
}

export { formatMoney };
