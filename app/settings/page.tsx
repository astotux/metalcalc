"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Clock } from "lucide-react";
import { PROFILE_SHAPE_CATALOG } from "@/features/profiles/defaults";
import { useProjectStore } from "@/store/useProjectStore";
import type { CurrencyCode, WeldPricingMode } from "@/types";

export default function SettingsPage() {
  const project = useProjectStore((s) => s.project);
  const saveStatus = useProjectStore((s) => s.saveStatus);
  const lastError = useProjectStore((s) => s.lastError);
  const hydrateFromStorage = useProjectStore((s) => s.hydrateFromStorage);
  const updateCalculationSettings = useProjectStore((s) => s.updateCalculationSettings);
  const updateGridSettings = useProjectStore((s) => s.updateGridSettings);
  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);

  useEffect(() => {
    void hydrateFromStorage();
  }, [hydrateFromStorage]);

  return (
    <div className="min-h-screen bg-[var(--mc-bg-app)] text-[var(--mc-text)]">
      <header className="flex h-12 items-center justify-between border-b border-[var(--mc-border)] bg-[var(--mc-bg-panel)] px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            В редактор
          </Link>
          <span className="text-sm font-semibold text-[var(--mc-text)]">Настройки MetalCalc</span>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === "saved" && (
            <span className="hidden items-center gap-1 text-xs text-[var(--mc-success-text)] sm:inline-flex">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Сохранено
            </span>
          )}
          {saveStatus === "unsaved" && (
            <span className="hidden items-center gap-1 text-xs text-[var(--mc-warning-text)] sm:inline-flex">
              <Clock className="h-3.5 w-3.5" />
              Есть несохранённые изменения
            </span>
          )}
          {saveStatus === "error" && (
            <span className="hidden items-center gap-1 text-xs text-[var(--mc-danger-text)] sm:inline-flex">
              <AlertCircle className="h-3.5 w-3.5" />
              {lastError ?? "Ошибка"}
            </span>
          )}
          <button
            type="button"
            onClick={() => void saveCurrentProject()}
            disabled={saveStatus === "saving"}
            className="inline-flex items-center gap-1.5 rounded bg-[var(--mc-brand)] px-3 py-1.5 text-xs font-medium text-[var(--mc-brand-text)] hover:bg-[var(--mc-brand-light)] disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" />
            {saveStatus === "saving" ? "Сохранение..." : "Сохранить проект"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 p-6">
        {/* Настройки тарифов */}
        <section className="space-y-4 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-4">
          <h1 className="text-sm font-semibold text-[var(--mc-text)]">
            Тарифы расчёта для проекта «{project.name}»
          </h1>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-xs text-[var(--mc-text-muted)]">
              Валюта сметы
              <select
                value={project.calculationSettings.currency}
                onChange={(e) =>
                  updateCalculationSettings({
                    currency: e.target.value as CurrencyCode,
                  })
                }
                className="mt-1 w-full rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2.5 py-2 text-xs text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-border)]"
              >
                <option value="RUB">Российский рубль (₽)</option>
                <option value="USD">Доллар США ($)</option>
                <option value="EUR">Евро (€)</option>
                <option value="KZT">Тенге (₸)</option>
                <option value="BYN">Белорусский рубль (Br)</option>
              </select>
            </label>

            <label className="text-xs text-[var(--mc-text-muted)]">
              Стоимость покраски за погонный метр
              <input
                type="number"
                min={0}
                value={project.calculationSettings.paintingPricePerMeter}
                onChange={(e) =>
                  updateCalculationSettings({
                    paintingPricePerMeter: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="mt-1 w-full rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2.5 py-2 text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-border)]"
              />
            </label>

            <label className="text-xs text-[var(--mc-text-muted)]">
              Способ расчёта сварки
              <select
                value={project.calculationSettings.weldPricingMode}
                onChange={(e) =>
                  updateCalculationSettings({
                    weldPricingMode: e.target.value as WeldPricingMode,
                  })
                }
                className="mt-1 w-full rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2.5 py-2 text-xs text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-border)]"
              >
                <option value="per_joint">Цена за одно соединение</option>
                <option value="per_meter">Цена за погонный метр сварного шва</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-[var(--mc-text-muted)]">
                За 1 соединение
                <input
                  type="number"
                  min={0}
                  value={project.calculationSettings.weldPricePerJoint}
                  onChange={(e) =>
                    updateCalculationSettings({
                      weldPricePerJoint: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="mt-1 w-full rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2.5 py-2 text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-border)]"
                />
              </label>

              <label className="text-xs text-[var(--mc-text-muted)]">
                За 1 м шва
                <input
                  type="number"
                  min={0}
                  value={project.calculationSettings.weldPricePerMeter}
                  onChange={(e) =>
                    updateCalculationSettings({
                      weldPricePerMeter: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="mt-1 w-full rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2.5 py-2 text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-border)]"
                />
              </label>
            </div>
          </div>
        </section>

        {/* Настройки сетки */}
        <section className="space-y-4 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-4">
          <h2 className="text-sm font-semibold text-[var(--mc-text)]">Параметры координатной сетки</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-xs text-[var(--mc-text-muted)]">
              Основной шаг сетки (мм)
              <input
                type="number"
                min={50}
                step={50}
                value={project.gridSettings.majorStepMm}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val >= 50) updateGridSettings({ majorStepMm: val });
                }}
                className="mt-1 w-full rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2.5 py-2 text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-border)]"
              />
            </label>
            <label className="text-xs text-[var(--mc-text-muted)]">
              Мелкий шаг сетки (мм)
              <input
                type="number"
                min={10}
                step={10}
                value={project.gridSettings.minorStepMm}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val >= 10) updateGridSettings({ minorStepMm: val });
                }}
                className="mt-1 w-full rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2.5 py-2 text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-border)]"
              />
            </label>
          </div>
        </section>

        {/* Архитектура типов сечений */}
        <section className="space-y-3 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-4">
          <h2 className="text-sm font-semibold text-[var(--mc-text)]">
            Поддерживаемые типы сечений металлопроката
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PROFILE_SHAPE_CATALOG.map((shape) => (
              <div
                key={shape.type}
                className="rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] p-2.5 text-xs"
              >
                <div className="font-medium text-[var(--mc-text)]">{shape.label}</div>
                <div
                  className={`mt-1 text-[11px] ${
                    shape.implementedInMvp ? "text-[var(--mc-success-text)]" : "text-[var(--mc-text-subtle)]"
                  }`}
                >
                  {shape.implementedInMvp ? "Активно в MVP" : "Заложено в архитектуру"}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
