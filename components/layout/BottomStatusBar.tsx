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
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-[var(--mc-border)] bg-[var(--mc-bg-panel)] px-3 text-[11px] text-[var(--mc-text-muted)]">
      <div className="flex items-center gap-4">
        <span>
          Элементов: <strong className="tabular-nums text-[var(--mc-text)]">{estimate.elementCount}</strong>
        </span>
        <span>
          Общая длина:{" "}
          <strong className="tabular-nums text-[var(--mc-text)]">
            {estimate.totalLengthMeters.toFixed(2)} м
          </strong>{" "}
          <span className="hidden sm:inline text-[var(--mc-text-subtle)]">
            ({Math.round(estimate.totalLengthMm)} мм)
          </span>
        </span>
        <span>
          Масштаб:{" "}
          <strong className="tabular-nums text-[var(--mc-text)]">
            {project.displaySettings.zoomPercent}%
          </strong>
        </span>
      </div>

      <div className="flex items-center gap-4">
        <span>
          Общая стоимость:{" "}
          <strong className="tabular-nums text-[var(--mc-brand-inline)]">
            {formatMoney(estimate.totalCost, estimate.currency)}
          </strong>
        </span>

        <div className="flex items-center gap-1.5">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--mc-brand-inline)]" />
              <span className="text-[var(--mc-brand-inline)]">Сохранение...</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--mc-success-text)]" />
              <span className="text-[var(--mc-success-text)]">Сохранено (SQLite)</span>
            </>
          )}
          {saveStatus === "unsaved" && (
            <>
              <Clock className="h-3.5 w-3.5 text-[var(--mc-warning-text)]" />
              <span className="text-[var(--mc-warning-text)]">Не сохранено</span>
            </>
          )}
          {saveStatus === "error" && (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-[var(--mc-danger-text)]" />
              <span className="max-w-[260px] truncate text-[var(--mc-danger-text)]" title={lastError ?? undefined}>
                {lastError ?? "Ошибка сохранения"}
              </span>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
