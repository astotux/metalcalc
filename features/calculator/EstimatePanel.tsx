"use client";

import { useState } from "react";
import { AlertTriangle, Calculator, FileSpreadsheet } from "lucide-react";
import { EstimateModal } from "@/components/common/EstimateModal";
import { calculateProjectEstimate, formatMoney } from "@/lib/calculations/estimate";
import { useProjectStore } from "@/store/useProjectStore";
import type { CurrencyCode, WeldPricingMode } from "@/types";

export function EstimatePanel() {
  const project = useProjectStore((s) => s.project);
  const updateCalculationSettings = useProjectStore((s) => s.updateCalculationSettings);
  const [modalOpen, setModalOpen] = useState(false);

  const estimate = calculateProjectEstimate(
    project.elements,
    project.profiles,
    project.joints,
    project.calculationSettings
  );

  const excludedMeters = Math.max(
    0,
    Math.round((estimate.totalLengthMeters - estimate.paintableLengthMeters) * 1000) / 1000
  );

  return (
    <>
      <div className="space-y-3 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Calculator className="h-3.5 w-3.5 text-[var(--mc-brand-light)]" />
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mc-text-muted)]">
              Калькулятор и смета
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-2 py-0.5 text-[11px] font-medium text-[var(--mc-text)] transition-colors hover:bg-[var(--mc-bg-hover)]"
          >
            <FileSpreadsheet className="h-3 w-3 text-[var(--mc-brand-light)]" />
            Смета
          </button>
        </div>

        {/* Тарифы */}
        <div className="space-y-2 rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-app)] p-2.5">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] text-[var(--mc-text-muted)]">
              Валюта
              <select
                value={project.calculationSettings.currency}
                onChange={(e) =>
                  updateCalculationSettings({
                    currency: e.target.value as CurrencyCode,
                  })
                }
                className="mt-0.5 w-full rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2 py-1 text-xs text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-light)]"
              >
                <option value="RUB">RUB (₽)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="KZT">KZT (₸)</option>
                <option value="BYN">BYN (Br)</option>
              </select>
            </label>

            <label className="text-[10px] text-[var(--mc-text-muted)]">
              Покраска / м
              <input
                type="number"
                min={0}
                value={project.calculationSettings.paintingPricePerMeter}
                onChange={(e) =>
                  updateCalculationSettings({
                    paintingPricePerMeter: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="mt-0.5 w-full rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2 py-1 font-mono text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-light)]"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] text-[var(--mc-text-muted)]">
              Расчёт сварки
              <select
                value={project.calculationSettings.weldPricingMode}
                onChange={(e) =>
                  updateCalculationSettings({
                    weldPricingMode: e.target.value as WeldPricingMode,
                  })
                }
                className="mt-0.5 w-full rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2 py-1 text-xs text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-light)]"
              >
                <option value="per_joint">За соединение</option>
                <option value="per_meter">За 1 м шва</option>
              </select>
            </label>

            <label className="text-[10px] text-[var(--mc-text-muted)]">
              {project.calculationSettings.weldPricingMode === "per_joint"
                ? "Тариф / стык"
                : "Тариф / м шва"}
              <input
                type="number"
                min={0}
                value={
                  project.calculationSettings.weldPricingMode === "per_joint"
                    ? project.calculationSettings.weldPricePerJoint
                    : project.calculationSettings.weldPricePerMeter
                }
                onChange={(e) => {
                  const value = Math.max(0, Number(e.target.value) || 0);
                  if (project.calculationSettings.weldPricingMode === "per_joint") {
                    updateCalculationSettings({ weldPricePerJoint: value });
                  } else {
                    updateCalculationSettings({ weldPricePerMeter: value });
                  }
                }}
                className="mt-0.5 w-full rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2 py-1 font-mono text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-light)]"
              />
            </label>
          </div>
        </div>

        {/* Разбивка по профилям */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-[var(--mc-text-muted)]">
            Металл по профилям ({estimate.totalLengthMeters.toFixed(2)} м)
          </div>
          {estimate.profileItems.length === 0 ? (
            <div className="rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-app)] p-3 text-center text-xs text-[var(--mc-text-subtle)]">
              В конструкции нет элементов.
            </div>
          ) : (
            <div className="space-y-1">
              {estimate.profileItems.map((item) => (
                <div
                  key={item.profileId}
                  className="rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-app)] px-2.5 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="h-3 w-1.5 shrink-0 rounded-xs"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate font-medium text-[var(--mc-text)]">
                        {item.profileName}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono font-semibold tabular-nums text-[var(--mc-text)]">
                      {formatMoney(item.totalCost, estimate.currency)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex justify-between font-mono text-[10px] text-[var(--mc-text-muted)]">
                    <span>
                      {item.elementCount} шт · {item.totalLengthMeters.toFixed(3)} м
                    </span>
                    <span className="tabular-nums">
                      {formatMoney(item.pricePerMeter, estimate.currency)}/м
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Покраска и сварка */}
        <div className="space-y-1.5 rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-app)] p-2.5 text-xs">
          <div className="flex justify-between text-[var(--mc-text-muted)]">
            <span>Металл:</span>
            <span className="font-mono tabular-nums text-[var(--mc-text)]">
              {formatMoney(estimate.metalCost, estimate.currency)}
            </span>
          </div>
          <div className="flex justify-between text-[var(--mc-text-muted)]">
            <span>
              Покраска ({estimate.paintableLengthMeters.toFixed(2)} м
              {excludedMeters > 0 ? `, искл. ${excludedMeters.toFixed(2)} м` : ""}):
            </span>
            <span className="font-mono tabular-nums text-[var(--mc-text)]">
              {formatMoney(estimate.paintingCost, estimate.currency)}
            </span>
          </div>
          <div className="flex justify-between text-[var(--mc-text-muted)]">
            <span>
              Сварка ({estimate.jointCount} соед.
              {estimate.knownWeldLengthMeters > 0
                ? `, ${estimate.knownWeldLengthMeters.toFixed(2)} м`
                : ""}
              ):
            </span>
            <span className="font-mono tabular-nums text-[var(--mc-text)]">
              {formatMoney(estimate.weldingCost, estimate.currency)}
            </span>
          </div>

          {estimate.hasUnknownWeldLength &&
            project.calculationSettings.weldPricingMode === "per_meter" && (
              <div className="mt-1 flex items-start gap-1.5 rounded-md border border-[var(--mc-warning-border)] bg-[var(--mc-warning-soft)] p-2 text-[10px] text-[var(--mc-warning-text)]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  У части соединений не указана длина шва. Укажите её во вкладке «Стыки» или
                  переключите режим на «За соединение».
                </span>
              </div>
            )}

          <div className="flex items-center justify-between border-t border-[var(--mc-border)] pt-2 font-semibold text-[var(--mc-text)]">
            <span>ИТОГО:</span>
            <span className="font-mono text-base tabular-nums text-[var(--mc-brand-inline)]">
              {formatMoney(estimate.totalCost, estimate.currency)}
            </span>
          </div>
        </div>
      </div>

      <EstimateModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
