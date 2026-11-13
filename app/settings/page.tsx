"use client";

import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { PROFILE_SHAPE_CATALOG } from "@/features/profiles/defaults";
import { useProjectStore } from "@/store/useProjectStore";
import type { CurrencyCode, WeldPricingMode } from "@/types";

export default function SettingsPage() {
  const project = useProjectStore((s) => s.project);
  const updateCalculationSettings = useProjectStore((s) => s.updateCalculationSettings);
  const updateGridSettings = useProjectStore((s) => s.updateGridSettings);
  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);

  return (
    <div className="min-h-screen bg-[#141619] text-[#e6e8ec]">
      <header className="flex h-12 items-center justify-between border-b border-[#2c313a] bg-[#181b20] px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-[#c7cdd8] hover:bg-[#252a33] hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            В редактор
          </Link>
          <span className="text-sm font-semibold text-white">Настройки MetalCalc</span>
        </div>
        <button
          type="button"
          onClick={() => saveCurrentProject()}
          className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
        >
          <Check className="h-3.5 w-3.5" />
          Сохранить проект
        </button>
      </header>

      <main className="mx-auto max-w-4xl p-6 space-y-6">
        {/* Настройки тарифов */}
        <section className="rounded-lg border border-[#2c313a] bg-[#181b20] p-4 space-y-4">
          <h1 className="text-sm font-semibold text-white">
            Тарифы расчёта для проекта «{project.name}»
          </h1>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-xs text-[#9aa2b1]">
              Валюта сметы
              <select
                value={project.calculationSettings.currency}
                onChange={(e) =>
                  updateCalculationSettings({
                    currency: e.target.value as CurrencyCode,
                  })
                }
                className="mt-1 w-full rounded border border-[#2c313a] bg-[#121417] px-2.5 py-2 text-xs text-white outline-none"
              >
                <option value="RUB">Российский рубль (₽)</option>
                <option value="USD">Доллар США ($)</option>
                <option value="EUR">Евро (€)</option>
                <option value="KZT">Тенге (₸)</option>
                <option value="BYN">Белорусский рубль (Br)</option>
              </select>
            </label>

            <label className="text-xs text-[#9aa2b1]">
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
                className="mt-1 w-full rounded border border-[#2c313a] bg-[#121417] px-2.5 py-2 text-xs tabular-nums text-white outline-none"
              />
            </label>

            <label className="text-xs text-[#9aa2b1]">
              Способ расчёта сварки
              <select
                value={project.calculationSettings.weldPricingMode}
                onChange={(e) =>
                  updateCalculationSettings({
                    weldPricingMode: e.target.value as WeldPricingMode,
                  })
                }
                className="mt-1 w-full rounded border border-[#2c313a] bg-[#121417] px-2.5 py-2 text-xs text-white outline-none"
              >
                <option value="per_joint">Цена за одно соединение</option>
                <option value="per_meter">Цена за погонный метр сварного шва</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-[#9aa2b1]">
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
                  className="mt-1 w-full rounded border border-[#2c313a] bg-[#121417] px-2.5 py-2 text-xs tabular-nums text-white outline-none"
                />
              </label>

              <label className="text-xs text-[#9aa2b1]">
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
                  className="mt-1 w-full rounded border border-[#2c313a] bg-[#121417] px-2.5 py-2 text-xs tabular-nums text-white outline-none"
                />
              </label>
            </div>
          </div>
        </section>

        {/* Настройки сетки */}
        <section className="rounded-lg border border-[#2c313a] bg-[#181b20] p-4 space-y-4">
          <h2 className="text-sm font-semibold text-white">Параметры координатной сетки</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-xs text-[#9aa2b1]">
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
                className="mt-1 w-full rounded border border-[#2c313a] bg-[#121417] px-2.5 py-2 text-xs tabular-nums text-white outline-none"
              />
            </label>
            <label className="text-xs text-[#9aa2b1]">
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
                className="mt-1 w-full rounded border border-[#2c313a] bg-[#121417] px-2.5 py-2 text-xs tabular-nums text-white outline-none"
              />
            </label>
          </div>
        </section>

        {/* Архитектура типов сечений */}
        <section className="rounded-lg border border-[#2c313a] bg-[#181b20] p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white">
            Поддерживаемые типы сечений металлопроката
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PROFILE_SHAPE_CATALOG.map((shape) => (
              <div
                key={shape.type}
                className="rounded border border-[#2c313a] bg-[#141619] p-2.5 text-xs"
              >
                <div className="font-medium text-[#e6e8ec]">{shape.label}</div>
                <div
                  className={`mt-1 text-[11px] ${
                    shape.implementedInMvp ? "text-emerald-400" : "text-[#6c7484]"
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
