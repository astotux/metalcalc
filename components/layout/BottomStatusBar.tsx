"use client";

import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
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
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-[#2c313a] bg-[#181b20] px-3 text-[11px] text-[#9aa2b1]">
      <div className="flex items-center gap-4">
        <span>
          Элементов: <strong className="tabular-nums text-[#e6e8ec]">{estimate.elementCount}</strong>
        </span>
        <span>
          Общая длина:{" "}
          <strong className="tabular-nums text-[#e6e8ec]">
            {estimate.totalLengthMeters.toFixed(2)} м
          </strong>{" "}
          <span className="hidden sm:inline text-[#6c7484]">
            ({Math.round(estimate.totalLengthMm)} мм)
          </span>
        </span>
        <span>
          Масштаб:{" "}
          <strong className="tabular-nums text-[#e6e8ec]">
            {project.displaySettings.zoomPercent}%
          </strong>
        </span>
      </div>

      <div className="flex items-center gap-4">
        <span>
          Общая стоимость:{" "}
          <strong className="tabular-nums text-blue-400">
            {formatMoney(estimate.totalCost, estimate.currency)}
          </strong>
        </span>

        <div className="flex items-center gap-1.5">
          {saveStatus === "saved" && (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-300">Сохранено</span>
            </>
          )}
          {saveStatus === "unsaved" && (
            <>
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-amber-300">Не сохранено</span>
            </>
          )}
          {saveStatus === "error" && (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
              <span className="text-rose-300">{lastError ?? "Ошибка сохранения"}</span>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
