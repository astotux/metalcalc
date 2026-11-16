"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  X,
} from "lucide-react";
import { downloadProjectExcel, downloadProjectPdf } from "@/features/export/exportClient";
import { calculateProjectEstimate, formatMoney } from "@/lib/calculations/estimate";
import { useProjectStore } from "@/store/useProjectStore";

interface EstimateModalProps {
  open: boolean;
  onClose: () => void;
}

export function EstimateModal({ open, onClose }: EstimateModalProps) {
  const project = useProjectStore((s) => s.project);
  const [copied, setCopied] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<"pdf" | "excel" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

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

  const handleExportExcel = async () => {
    setExportError(null);
    setExportingFormat("excel");
    try {
      await downloadProjectExcel(project);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "Не удалось скачать Excel-файл"
      );
    } finally {
      setExportingFormat(null);
    }
  };

  const handleExportPdf = async () => {
    setExportError(null);
    setExportingFormat("pdf");
    try {
      await downloadProjectPdf(project);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "Не удалось скачать PDF-файл"
      );
    } finally {
      setExportingFormat(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-xs sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="estimate-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--mc-border-strong)] bg-[var(--mc-bg-panel)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--mc-border)] px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-[var(--mc-brand-inline)]" />
            <h2 id="estimate-modal-title" className="text-sm font-semibold text-[var(--mc-text)]">
              Спецификация и смета — {project.name}
            </h2>
            {project.isExample && (
              <span className="rounded border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--mc-brand-inline)]">
                Примерные цены
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--mc-text-muted)] transition-colors hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
            aria-label="Закрыть окно сметы"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="overflow-x-auto rounded-lg border border-[var(--mc-border)]">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="bg-[var(--mc-bg-app)] text-[11px] text-[var(--mc-text-muted)]">
                <tr>
                  <th className="border-b border-[var(--mc-border)] px-3 py-2.5 font-medium">Материал</th>
                  <th className="border-b border-[var(--mc-border)] px-3 py-2.5 font-medium">Сечение</th>
                  <th className="border-b border-[var(--mc-border)] px-3 py-2.5 text-right font-medium">
                    Элементов
                  </th>
                  <th className="border-b border-[var(--mc-border)] px-3 py-2.5 text-right font-medium">
                    Длина, м
                  </th>
                  <th className="border-b border-[var(--mc-border)] px-3 py-2.5 text-right font-medium">
                    Цена / м
                  </th>
                  <th className="border-b border-[var(--mc-border)] px-3 py-2.5 text-right font-medium">
                    Стоимость
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--mc-border)]">
                {estimate.profileItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-[var(--mc-text-subtle)]">
                      В конструкции пока нет элементов.
                    </td>
                  </tr>
                ) : (
                  estimate.profileItems.map((item) => (
                    <tr key={item.profileId} className="transition-colors hover:bg-[var(--mc-bg-elevated)]">
                      <td className="px-3 py-2.5 font-medium text-[var(--mc-text)]">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-xs"
                            style={{ backgroundColor: item.color }}
                          />
                          {item.profileName}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--mc-text-muted)]">
                        {item.dimensionsLabel}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--mc-text)]">
                        {item.elementCount}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--mc-text)]">
                        {item.totalLengthMeters.toFixed(3)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--mc-text-muted)]">
                        {formatMoney(item.pricePerMeter, estimate.currency)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums text-[var(--mc-text)]">
                        {formatMoney(item.totalCost, estimate.currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-app)] p-3.5">
              <div className="text-[11px] text-[var(--mc-text-muted)]">
                Металл ({estimate.totalLengthMeters} м)
              </div>
              <div className="mt-1 font-mono text-base font-semibold tabular-nums text-[var(--mc-text)]">
                {formatMoney(estimate.metalCost, estimate.currency)}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-app)] p-3.5">
              <div className="text-[11px] text-[var(--mc-text-muted)]">
                Покраска ({estimate.paintableLengthMeters} м)
              </div>
              <div className="mt-1 font-mono text-base font-semibold tabular-nums text-[var(--mc-text)]">
                {formatMoney(estimate.paintingCost, estimate.currency)}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-app)] p-3.5">
              <div className="text-[11px] text-[var(--mc-text-muted)]">
                Сварка ({estimate.jointCount} соед.
                {estimate.knownWeldLengthMeters > 0
                  ? ` / ${estimate.knownWeldLengthMeters} м шва`
                  : ""}
                )
              </div>
              <div className="mt-1 font-mono text-base font-semibold tabular-nums text-[var(--mc-text)]">
                {formatMoney(estimate.weldingCost, estimate.currency)}
              </div>
            </div>
          </div>

          {estimate.hasUnknownWeldLength &&
            project.calculationSettings.weldPricingMode === "per_meter" && (
              <div className="rounded-lg border border-[var(--mc-warning-border)] bg-[var(--mc-warning-soft)] px-3.5 py-2.5 text-xs text-[var(--mc-warning-text)]">
                Часть соединений не имеет заданной длины сварного шва. В режиме расчёта за метр шва
                учтены только соединения с явно указанной длиной.
              </div>
            )}

          <div className="flex items-center justify-between rounded-lg border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] px-4 py-3.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--mc-brand-inline)]">
              Итоговая стоимость конструкции
            </span>
            <span className="font-mono text-xl font-bold tabular-nums text-[var(--mc-text)]">
              {formatMoney(estimate.totalCost, estimate.currency)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 border-t border-[var(--mc-border)] bg-[var(--mc-bg-app)] px-5 py-3.5">
          {exportError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-[var(--mc-danger-border)] bg-[var(--mc-danger-soft)] px-3 py-2 text-xs text-[var(--mc-danger-text)]"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{exportError}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-[var(--mc-text-muted)]">
              Экспорт включает спецификацию, чертёж (3 проекции в PDF) и итоговую смету.
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyText}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--mc-border-strong)] bg-[var(--mc-bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--mc-text)] transition-colors hover:bg-[var(--mc-bg-hover)]"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-[var(--mc-success-text)]" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Скопировано" : "Копировать"}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--mc-border-strong)] bg-[var(--mc-bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--mc-text)] transition-colors hover:bg-[var(--mc-bg-hover)]"
              >
                <Printer className="h-3.5 w-3.5" />
                Печать
              </button>
              <button
                type="button"
                onClick={() => void handleExportExcel()}
                disabled={exportingFormat !== null}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--mc-success-border)] bg-[var(--mc-success-soft)] px-3 py-1.5 text-xs font-medium text-[var(--mc-success-text)] transition-colors hover:opacity-85 disabled:opacity-60"
              >
                {exportingFormat === "excel" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={() => void handleExportPdf()}
                disabled={exportingFormat !== null}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--mc-brand)] px-3.5 py-1.5 text-xs font-semibold text-[var(--mc-brand-text)] transition-colors hover:bg-[var(--mc-brand-light)] disabled:opacity-60"
              >
                {exportingFormat === "pdf" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
                PDF (.pdf)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
