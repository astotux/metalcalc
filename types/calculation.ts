/** Поддерживаемые валюты для сметы. */
export type CurrencyCode = "RUB" | "USD" | "EUR" | "KZT" | "BYN";

/** Способ расчёта стоимости сварочных работ. */
export type WeldPricingMode = "per_meter" | "per_joint";

/** Настройки расчёта стоимости материалов и работ. */
export interface CalculationSettings {
  currency: CurrencyCode;
  /** Цена покраски за 1 погонный метр. */
  paintingPricePerMeter: number;
  /** Режим расчёта сварки: за погонный метр шва или за одно соединение. */
  weldPricingMode: WeldPricingMode;
  /** Цена сварки за 1 погонный метр сварного шва. */
  weldPricePerMeter: number;
  /** Цена сварки за 1 соединение. */
  weldPricePerJoint: number;
}

/** Позиция сметы по отдельному виду профиля. */
export interface ProfileEstimateItem {
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

/** Итоговая автоматическая смета конструкции. */
export interface CostEstimate {
  elementCount: number;
  totalLengthMm: number;
  totalLengthMeters: number;
  paintableLengthMm: number;
  paintableLengthMeters: number;
  profileItems: ProfileEstimateItem[];
  metalCost: number;
  paintingCost: number;
  jointCount: number;
  knownWeldLengthMm: number;
  knownWeldLengthMeters: number;
  /** true, если в режиме per_meter есть соединения без указанной длины шва. */
  hasUnknownWeldLength: boolean;
  weldingCost: number;
  totalCost: number;
  currency: CurrencyCode;
}
