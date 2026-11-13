import { getElementLengthMm, mmToMeters } from "@/lib/geometry/elements";
import type {
  CalculationSettings,
  ConstructionElement,
  CostEstimate,
  CurrencyCode,
  JointConnection,
  MaterialProfile,
  ProfileEstimateItem,
} from "@/types";

const CURRENCY_LABELS: Record<CurrencyCode, { symbol: string; locale: string }> = {
  RUB: { symbol: "₽", locale: "ru-RU" },
  USD: { symbol: "$", locale: "en-US" },
  EUR: { symbol: "€", locale: "de-DE" },
  KZT: { symbol: "₸", locale: "ru-KZ" },
  BYN: { symbol: "Br", locale: "ru-BY" },
};

/**
 * Денежное округление до 2 знаков (копейки/центы) через целые сотые доли,
 * чтобы избежать погрешностей двоичной арифметики с плавающей точкой.
 */
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** Форматирует денежную сумму в выбранной валюте. */
export function formatMoney(amount: number, currency: CurrencyCode): string {
  const rounded = roundMoney(amount);
  const meta = CURRENCY_LABELS[currency];
  const formattedNumber = new Intl.NumberFormat(meta.locale, {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rounded);
  return `${formattedNumber} ${meta.symbol}`;
}

/** Форматирует габариты сечения профиля (например, 40×20×2 мм). */
export function formatProfileDimensions(profile: MaterialProfile): string {
  if (profile.shapeType === "round_tube" && profile.diameterMm) {
    return `Ø${profile.diameterMm}×${profile.wallThicknessMm} мм`;
  }
  return `${profile.widthMm}×${profile.heightMm}×${profile.wallThicknessMm} мм`;
}

/**
 * Полностью пересчитывает смету конструкции на основании единой модели элементов,
 * каталога профилей, соединений и тарифов на работы.
 */
export function calculateProjectEstimate(
  elements: ConstructionElement[],
  profiles: MaterialProfile[],
  joints: JointConnection[],
  settings: CalculationSettings
): CostEstimate {
  const profileMap = new Map<string, MaterialProfile>();
  for (const profile of profiles) {
    profileMap.set(profile.id, profile);
  }

  const groupedByProfile = new Map<
    string,
    { profile: MaterialProfile; elementCount: number; totalLengthMm: number }
  >();

  let totalLengthMm = 0;
  let paintableLengthMm = 0;

  for (const element of elements) {
    const lengthMm = getElementLengthMm(element);
    totalLengthMm += lengthMm;

    if (!element.excludeFromPainting) {
      paintableLengthMm += lengthMm;
    }

    const profile = profileMap.get(element.profileId);
    if (!profile) continue;

    const existing = groupedByProfile.get(profile.id);
    if (existing) {
      existing.elementCount += 1;
      existing.totalLengthMm += lengthMm;
    } else {
      groupedByProfile.set(profile.id, {
        profile,
        elementCount: 1,
        totalLengthMm: lengthMm,
      });
    }
  }

  const profileItems: ProfileEstimateItem[] = [];
  let metalCost = 0;

  for (const entry of groupedByProfile.values()) {
    const lengthMeters = mmToMeters(entry.totalLengthMm);
    const itemCost = roundMoney(lengthMeters * entry.profile.pricePerMeter);
    metalCost = roundMoney(metalCost + itemCost);

    profileItems.push({
      profileId: entry.profile.id,
      profileName: entry.profile.name,
      dimensionsLabel: formatProfileDimensions(entry.profile),
      wallThicknessMm: entry.profile.wallThicknessMm,
      elementCount: entry.elementCount,
      totalLengthMm: entry.totalLengthMm,
      totalLengthMeters: Math.round(lengthMeters * 1000) / 1000,
      pricePerMeter: entry.profile.pricePerMeter,
      totalCost: itemCost,
      color: entry.profile.color,
    });
  }

  const totalLengthMeters = Math.round(mmToMeters(totalLengthMm) * 1000) / 1000;
  const paintableLengthMeters = Math.round(mmToMeters(paintableLengthMm) * 1000) / 1000;

  const paintingCost = roundMoney(paintableLengthMeters * settings.paintingPricePerMeter);

  let knownWeldLengthMm = 0;
  let hasUnknownWeldLength = false;

  for (const joint of joints) {
    if (joint.weldLengthMm === null || joint.weldLengthMm === undefined) {
      hasUnknownWeldLength = true;
    } else {
      knownWeldLengthMm += joint.weldLengthMm;
    }
  }

  const knownWeldLengthMeters = Math.round(mmToMeters(knownWeldLengthMm) * 1000) / 1000;

  let weldingCost = 0;
  if (settings.weldPricingMode === "per_joint") {
    weldingCost = roundMoney(joints.length * settings.weldPricePerJoint);
  } else {
    weldingCost = roundMoney(knownWeldLengthMeters * settings.weldPricePerMeter);
  }

  const totalCost = roundMoney(metalCost + paintingCost + weldingCost);

  return {
    elementCount: elements.length,
    totalLengthMm,
    totalLengthMeters,
    paintableLengthMm,
    paintableLengthMeters,
    profileItems,
    metalCost,
    paintingCost,
    jointCount: joints.length,
    knownWeldLengthMm,
    knownWeldLengthMeters,
    hasUnknownWeldLength,
    weldingCost,
    totalCost,
    currency: settings.currency,
  };
}
