"use client";

import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { calculateProjectEstimate, formatMoney } from "@/lib/calculations/estimate";
import { useProjectStore } from "@/store/useProjectStore";

export function BottomStatusBar() {
  const project = useProjectStore((s) => s.project);
  const saveStatus = useProjectStore((s) => s.saveStatus);
  const lastError = useProjectStore((s) => s.lastError);

  const estimate = calculateProjectEstimate(
    project.elements,
    project.profiles,
    project.joints,
    project.calculationSettings
  );

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between gap-2 border-t border-[var(--mc-border)] bg-[var(--mc-bg-panel)] px-2.5 text-[11px] text-[var(--mc-text-muted)] lg:px-3">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
        <span className="shrink-0">
          <span className="hidden sm:inline">Элементов: </span>
          <span className="sm:hidden">Эл.: </span>
          <strong className="tabular-nums text-[var(--mc-text)]">{estimate.elementCount}</strong>
        </span>
        <span className="shrink-0">
          <span className="hidden md:inline">Общая длина: </span>
          <span className="md:hidden">Длина: </span>
          <strong className="tabular-nums text-[var(--mc-text)]">
            {estimate.totalLengthMeters.toFixed(2)} м
          </strong>{" "}
          <span className="hidden lg:inline text-[var(--mc-text-subtle)]">
            ({Math.round(estimate.totalLengthMm)} мм)
          </span>
        </span>
        <span className="hidden sm:inline shrink-0">
          Масштаб:{" "}
          <strong className="tabular-nums text-[var(--mc-text)]">
            {project.displaySettings.zoomPercent}%
          </strong>
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2.5 sm:gap-4">
        <span>
          <span className="hidden md:inline">Общая стоимость: </span>
          <span className="md:hidden">Итого: </span>
          <strong className="tabular-nums text-[var(--mc-brand-inline)]">
            {formatMoney(estimate.totalCost, estimate.currency)}
          </strong>
        </span>

        <div className="flex items-center gap-1.5">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--mc-brand-inline)]" />
              <span className="hidden sm:inline text-[var(--mc-brand-inline)]">Сохранение...</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--mc-success-text)]" />
              <span className="hidden sm:inline text-[var(--mc-success-text)]">Сохранено</span>
            </>
          )}
          {saveStatus === "unsaved" && (
            <>
              <Clock className="h-3.5 w-3.5 text-[var(--mc-warning-text)]" />
              <span className="hidden sm:inline text-[var(--mc-warning-text)]">Не сохранено</span>
            </>
          )}
          {saveStatus === "error" && (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-[var(--mc-danger-text)]" />
              <span className="max-w-[180px] truncate text-[var(--mc-danger-text)] sm:max-w-[260px]" title={lastError ?? undefined}>
                {lastError ?? "Ошибка сохранения"}
              </span>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
