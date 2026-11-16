"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Calculator,
  Check,
  CheckCircle2,
  Clock,
  Grid3x3,
  Moon,
  Palette,
  Sun,
} from "lucide-react";
import { AccountHeaderBadge } from "@/components/auth/AccountHeaderBadge";
import { useProjectStore } from "@/store/useProjectStore";
import { useThemeStore } from "@/store/useThemeStore";
import type { CurrencyCode, WeldPricingMode } from "@/types";

export function SettingsClient() {
  const project = useProjectStore((s) => s.project);
  const saveStatus = useProjectStore((s) => s.saveStatus);
  const lastError = useProjectStore((s) => s.lastError);
  const hydrateFromStorage = useProjectStore((s) => s.hydrateFromStorage);
  const updateCalculationSettings = useProjectStore((s) => s.updateCalculationSettings);
  const updateGridSettings = useProjectStore((s) => s.updateGridSettings);
  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);

  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    void hydrateFromStorage();
  }, [hydrateFromStorage]);

  return (
    <div className="min-h-screen bg-[var(--mc-bg-app)] text-[var(--mc-text)]">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-[var(--mc-border)] bg-[var(--mc-bg-panel)]/90 px-4 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/editor"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--mc-text-secondary)] transition-colors hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>В редактор</span>
          </Link>
          <div className="hidden h-4 w-px bg-[var(--mc-border)] sm:block" />
          <div className="flex items-center gap-2">
            <span className="hidden h-6 w-6 items-center justify-center rounded bg-[var(--mc-brand)] font-mono text-[10px] font-bold text-[var(--mc-brand-text)] sm:inline-flex">
              MC
            </span>
            <h1 className="text-sm font-semibold tracking-tight text-[var(--mc-text)]">
              Настройки проекта
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {saveStatus === "saved" && (
            <span className="hidden items-center gap-1.5 rounded-md border border-[var(--mc-success-border)] bg-[var(--mc-success-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--mc-success-text)] sm:inline-flex">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Сохранено
            </span>
          )}
          {saveStatus === "unsaved" && (
            <span className="hidden items-center gap-1.5 rounded-md border border-[var(--mc-warning-border)] bg-[var(--mc-warning-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--mc-warning-text)] sm:inline-flex">
              <Clock className="h-3.5 w-3.5" />
              Есть несохранённые изменения
            </span>
          )}
          {saveStatus === "error" && (
            <span className="hidden items-center gap-1.5 rounded-md border border-[var(--mc-danger-border)] bg-[var(--mc-danger-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--mc-danger-text)] sm:inline-flex">
              <AlertCircle className="h-3.5 w-3.5" />
              {lastError ?? "Ошибка"}
            </span>
          )}

          <button
            type="button"
            onClick={() => void saveCurrentProject()}
            disabled={saveStatus === "saving"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--mc-brand)] px-3.5 py-1.5 text-xs font-semibold text-[var(--mc-brand-text)] transition-colors hover:bg-[var(--mc-brand-light)] disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" />
            <span>{saveStatus === "saving" ? "Сохранение..." : "Сохранить проект"}</span>
          </button>

          <AccountHeaderBadge />
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        {/* Настройки тарифов */}
        <section className="space-y-5 rounded-xl border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-5 shadow-xs">
          <div className="flex items-start gap-3 border-b border-[var(--mc-border)] pb-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] text-[var(--mc-brand-inline)]">
              <Calculator className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--mc-text)]">
                Тарифы расчёта для проекта «{project.name}»
              </h2>
              <p className="mt-0.5 text-xs text-[var(--mc-text-muted)]">
                Задайте валюту сметы, стоимость покраски и метод расчёта сварных соединений.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium text-[var(--mc-text-secondary)]">
              Валюта сметы
              <select
                value={project.calculationSettings.currency}
                onChange={(e) =>
                  updateCalculationSettings({
                    currency: e.target.value as CurrencyCode,
                  })
                }
                className="mt-1.5 w-full rounded-lg border border-[var(--mc-border-strong)] bg-[var(--mc-bg-input)] px-3 py-2 text-xs text-[var(--mc-text)] outline-none transition-colors focus:border-[var(--mc-brand-light)]"
              >
                <option value="RUB">Российский рубль (₽)</option>
                <option value="USD">Доллар США ($)</option>
                <option value="EUR">Евро (€)</option>
                <option value="KZT">Тенге (₸)</option>
                <option value="BYN">Белорусский рубль (Br)</option>
              </select>
            </label>

            <label className="block text-xs font-medium text-[var(--mc-text-secondary)]">
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
                className="mt-1.5 w-full rounded-lg border border-[var(--mc-border-strong)] bg-[var(--mc-bg-input)] px-3 py-2 font-mono text-xs tabular-nums text-[var(--mc-text)] outline-none transition-colors focus:border-[var(--mc-brand-light)]"
              />
            </label>

            <label className="block text-xs font-medium text-[var(--mc-text-secondary)]">
              Способ расчёта сварки
              <select
                value={project.calculationSettings.weldPricingMode}
                onChange={(e) =>
                  updateCalculationSettings({
                    weldPricingMode: e.target.value as WeldPricingMode,
                  })
                }
                className="mt-1.5 w-full rounded-lg border border-[var(--mc-border-strong)] bg-[var(--mc-bg-input)] px-3 py-2 text-xs text-[var(--mc-text)] outline-none transition-colors focus:border-[var(--mc-brand-light)]"
              >
                <option value="per_joint">Цена за одно соединение</option>
                <option value="per_meter">Цена за погонный метр сварного шва</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              <label
                className={`block text-xs font-medium ${
                  project.calculationSettings.weldPricingMode === "per_joint"
                    ? "text-[var(--mc-text)]"
                    : "text-[var(--mc-text-muted)]"
                }`}
              >
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
                  className={`mt-1.5 w-full rounded-lg border bg-[var(--mc-bg-input)] px-3 py-2 font-mono text-xs tabular-nums text-[var(--mc-text)] outline-none transition-colors focus:border-[var(--mc-brand-light)] ${
                    project.calculationSettings.weldPricingMode === "per_joint"
                      ? "border-[var(--mc-brand-border)]"
                      : "border-[var(--mc-border)]"
                  }`}
                />
              </label>

              <label
                className={`block text-xs font-medium ${
                  project.calculationSettings.weldPricingMode === "per_meter"
                    ? "text-[var(--mc-text)]"
                    : "text-[var(--mc-text-muted)]"
                }`}
              >
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
                  className={`mt-1.5 w-full rounded-lg border bg-[var(--mc-bg-input)] px-3 py-2 font-mono text-xs tabular-nums text-[var(--mc-text)] outline-none transition-colors focus:border-[var(--mc-brand-light)] ${
                    project.calculationSettings.weldPricingMode === "per_meter"
                      ? "border-[var(--mc-brand-border)]"
                      : "border-[var(--mc-border)]"
                  }`}
                />
              </label>
            </div>
          </div>
        </section>

        {/* Настройки сетки */}
        <section className="space-y-5 rounded-xl border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-5 shadow-xs">
          <div className="flex items-start gap-3 border-b border-[var(--mc-border)] pb-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] text-[var(--mc-brand-inline)]">
              <Grid3x3 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--mc-text)]">
                Параметры координатной сетки
              </h2>
              <p className="mt-0.5 text-xs text-[var(--mc-text-muted)]">
                Шаг привязки и вспомогательных линий на 2D-чертеже и в 3D-плоскости.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium text-[var(--mc-text-secondary)]">
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
                className="mt-1.5 w-full rounded-lg border border-[var(--mc-border-strong)] bg-[var(--mc-bg-input)] px-3 py-2 font-mono text-xs tabular-nums text-[var(--mc-text)] outline-none transition-colors focus:border-[var(--mc-brand-light)]"
              />
            </label>

            <label className="block text-xs font-medium text-[var(--mc-text-secondary)]">
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
                className="mt-1.5 w-full rounded-lg border border-[var(--mc-border-strong)] bg-[var(--mc-bg-input)] px-3 py-2 font-mono text-xs tabular-nums text-[var(--mc-text)] outline-none transition-colors focus:border-[var(--mc-brand-light)]"
              />
            </label>
          </div>
        </section>

        {/* Оформление интерфейса */}
        <section className="space-y-4 rounded-xl border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-5 shadow-xs">
          <div className="flex items-start gap-3 border-b border-[var(--mc-border)] pb-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] text-[var(--mc-brand-inline)]">
              <Palette className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--mc-text)]">Тема интерфейса</h2>
              <p className="mt-0.5 text-xs text-[var(--mc-text-muted)]">
                Применяется ко всем страницам, 2D-проекциям и 3D-сцене.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setTheme("dark")}
              aria-pressed={theme === "dark"}
              className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition-colors ${
                theme === "dark"
                  ? "border-[var(--mc-brand-light)] bg-[var(--mc-brand-soft)]"
                  : "border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] hover:border-[var(--mc-border-strong)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0b0d12] text-[#f09a86] ring-1 ring-[#252a36]">
                  <Moon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[var(--mc-text)]">Тёмная (Графит)</div>
                  <div className="text-[11px] text-[var(--mc-text-muted)]">
                    Комфортна для длительного черчения
                  </div>
                </div>
              </div>
              {theme === "dark" && <CheckCircle2 className="h-4 w-4 text-[var(--mc-brand-inline)]" />}
            </button>

            <button
              type="button"
              onClick={() => setTheme("light")}
              aria-pressed={theme === "light"}
              className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition-colors ${
                theme === "light"
                  ? "border-[var(--mc-brand-light)] bg-[var(--mc-brand-soft)]"
                  : "border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] hover:border-[var(--mc-border-strong)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ffffff] text-[#a33b28] ring-1 ring-[#dfe3ea]">
                  <Sun className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[var(--mc-text)]">Светлая (Чертёж)</div>
                  <div className="text-[11px] text-[var(--mc-text-muted)]">
                    Контрастная дневная палитра
                  </div>
                </div>
              </div>
              {theme === "light" && <CheckCircle2 className="h-4 w-4 text-[var(--mc-brand-inline)]" />}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
