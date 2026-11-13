"use client";

import { useState } from "react";
import { Check, Copy, FileSpreadsheet, Printer, X } from "lucide-react";
import { calculateProjectEstimate, formatMoney } from "@/lib/calculations/estimate";
import { useProjectStore } from "@/store/useProjectStore";

interface EstimateModalProps {
  open: boolean;
  onClose: () => void;
}

export function EstimateModal({ open, onClose }: EstimateModalProps) {
  const project = useProjectStore((s) => s.project);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const estimate = calculateProjectEstimate(
    project.elements,
    project.profiles,
    project.joints,
    project.calculationSettings
  );

  const handleCopyText = async () => {
    const lines = [
      `Смета проекта: ${project.name}`,
      `Дата: ${new Date().toLocaleDateString("ru-RU")}`,
      "",
      "Материалы:",
      ...estimate.profileItems.map(
        (item) =>
          `- ${item.profileName} (${item.dimensionsLabel}): ${item.totalLengthMeters} м × ${formatMoney(item.pricePerMeter, estimate.currency)} = ${formatMoney(item.totalCost, estimate.currency)}`
      ),
      "",
      `Металл: ${formatMoney(estimate.metalCost, estimate.currency)}`,
      `Покраска (${estimate.paintableLengthMeters} м): ${formatMoney(estimate.paintingCost, estimate.currency)}`,
      `Сварка (${estimate.jointCount} соед.): ${formatMoney(estimate.weldingCost, estimate.currency)}`,
      `ИТОГО: ${formatMoney(estimate.totalCost, estimate.currency)}`,
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-[#343a46] bg-[#1b1e23] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#2c313a] px-4 py-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-[#e6e8ec]">
              Спецификация и смета — {project.name}
            </h2>
            {project.isExample && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-300">
                Примерные цены
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#9aa2b1] hover:bg-[#2a2f38] hover:text-white"
            aria-label="Закрыть окно сметы"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="overflow-x-auto rounded border border-[#2c313a]">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-[#141619] text-[#9aa2b1]">
                <tr>
                  <th className="border-b border-[#2c313a] px-3 py-2 font-medium">Материал</th>
                  <th className="border-b border-[#2c313a] px-3 py-2 font-medium">Сечение</th>
                  <th className="border-b border-[#2c313a] px-3 py-2 font-medium text-right">
                    Элементов
                  </th>
                  <th className="border-b border-[#2c313a] px-3 py-2 font-medium text-right">
                    Длина, м
                  </th>
                  <th className="border-b border-[#2c313a] px-3 py-2 font-medium text-right">
                    Цена / м
                  </th>
                  <th className="border-b border-[#2c313a] px-3 py-2 font-medium text-right">
                    Стоимость
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252932]">
                {estimate.profileItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-[#6c7484]">
                      В конструкции пока нет элементов.
                    </td>
                  </tr>
                ) : (
                  estimate.profileItems.map((item) => (
                    <tr key={item.profileId} className="hover:bg-[#22262d]">
                      <td className="px-3 py-2 font-medium text-[#e6e8ec]">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-xs"
                            style={{ backgroundColor: item.color }}
                          />
                          {item.profileName}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[#9aa2b1]">{item.dimensionsLabel}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#e6e8ec]">
                        {item.elementCount}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#e6e8ec]">
                        {item.totalLengthMeters.toFixed(3)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#9aa2b1]">
                        {formatMoney(item.pricePerMeter, estimate.currency)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums text-[#e6e8ec]">
                        {formatMoney(item.totalCost, estimate.currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded border border-[#2c313a] bg-[#141619] p-3">
              <div className="text-[11px] text-[#9aa2b1]">Металл ({estimate.totalLengthMeters} м)</div>
              <div className="mt-1 text-base font-semibold tabular-nums text-white">
                {formatMoney(estimate.metalCost, estimate.currency)}
              </div>
            </div>
            <div className="rounded border border-[#2c313a] bg-[#141619] p-3">
              <div className="text-[11px] text-[#9aa2b1]">
                Покраска ({estimate.paintableLengthMeters} м)
              </div>
              <div className="mt-1 text-base font-semibold tabular-nums text-white">
                {formatMoney(estimate.paintingCost, estimate.currency)}
              </div>
            </div>
            <div className="rounded border border-[#2c313a] bg-[#141619] p-3">
              <div className="text-[11px] text-[#9aa2b1]">
                Сварка ({estimate.jointCount} соед.
                {estimate.knownWeldLengthMeters > 0
                  ? ` / ${estimate.knownWeldLengthMeters} м шва`
                  : ""}
                )
              </div>
              <div className="mt-1 text-base font-semibold tabular-nums text-white">
                {formatMoney(estimate.weldingCost, estimate.currency)}
              </div>
            </div>
          </div>

          {estimate.hasUnknownWeldLength &&
            project.calculationSettings.weldPricingMode === "per_meter" && (
              <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Часть соединений не имеет заданной длины сварного шва. В режиме расчёта за метр шва
                учтены только соединения с явно указанной длиной.
              </div>
            )}

          <div className="flex items-center justify-between rounded border border-blue-500/30 bg-blue-500/10 px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-wider text-blue-200">
              Итоговая стоимость конструкции
            </span>
            <span className="text-xl font-bold tabular-nums text-white">
              {formatMoney(estimate.totalCost, estimate.currency)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#2c313a] bg-[#16191e] px-4 py-3">
          <span className="text-[11px] text-[#6c7484]">
            Экспорт файлов в форматы PDF и Excel будет добавлен на этапе 7.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="inline-flex items-center gap-1.5 rounded border border-[#343a46] bg-[#22262d] px-3 py-1.5 text-xs font-medium text-[#e6e8ec] hover:bg-[#2c313a]"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Скопировано" : "Копировать смету"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
            >
              <Printer className="h-3.5 w-3.5" />
              Печать
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
