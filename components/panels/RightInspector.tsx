"use client";

import { useState } from "react";
import { Calculator, Copy, Group, Sliders, Trash2, Ungroup } from "lucide-react";
import { calculateProjectEstimate, formatMoney, roundMoney } from "@/lib/calculations/estimate";
import { getElementLengthMm, mmToMeters, roundMm } from "@/lib/geometry/elements";
import { useProjectStore } from "@/store/useProjectStore";
import type { ConstructionElement, CurrencyCode, WeldPricingMode } from "@/types";

interface SelectedElementInspectorProps {
  selectedElement: ConstructionElement;
}

function SelectedElementInspector({ selectedElement }: SelectedElementInspectorProps) {
  const project = useProjectStore((s) => s.project);
  const updateElement = useProjectStore((s) => s.updateElement);
  const resizeElementLength = useProjectStore((s) => s.resizeElementLength);
  const deleteElements = useProjectStore((s) => s.deleteElements);
  const duplicateElement = useProjectStore((s) => s.duplicateElement);

  const lengthMm = roundMm(getElementLengthMm(selectedElement));
  const [lengthInput, setLengthInput] = useState(String(lengthMm));

  const profile = project.profiles.find((p) => p.id === selectedElement.profileId);
  const elementCost = profile
    ? roundMoney(mmToMeters(lengthMm) * profile.pricePerMeter)
    : 0;
  const effectiveColor = selectedElement.color ?? profile?.color ?? "#94a3b8";

  const applyLength = () => {
    const parsed = Number(lengthInput);
    if (Number.isFinite(parsed) && parsed >= 1) {
      resizeElementLength(selectedElement.id, parsed);
    } else {
      setLengthInput(String(lengthMm));
    }
  };

  const updateCoord = (
    endpoint: "start" | "end",
    axis: "x" | "y" | "z",
    rawValue: string
  ) => {
    const num = Number(rawValue);
    if (!Number.isFinite(num)) return;
    updateElement(selectedElement.id, {
      [endpoint]: {
        ...selectedElement[endpoint],
        [axis]: num,
      },
    });
  };

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-[#2c313a] bg-[#181b20] overflow-y-auto">
      <div className="border-b border-[#2c313a] px-3 py-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#9aa2b1]">
          Свойства элемента
        </div>
        <div className="mt-0.5 text-xs text-[#6c7484]">ID: {selectedElement.id}</div>
      </div>

      <div className="space-y-4 p-3">
        {/* Метка элемента */}
        <label className="block text-[11px] text-[#9aa2b1]">
          Название / пометка
          <input
            type="text"
            value={selectedElement.label ?? ""}
            onChange={(e) =>
              updateElement(selectedElement.id, { label: e.target.value })
            }
            placeholder="Например: Стойка левая"
            className="mt-1 w-full rounded border border-[#2c313a] bg-[#121417] px-2.5 py-1.5 text-xs text-white outline-none focus:border-blue-500"
          />
        </label>

        {/* Точная длина в миллиметрах */}
        <div>
          <label className="block text-[11px] text-[#9aa2b1]">
            Длина элемента (мм)
            <div className="mt-1 flex gap-1.5">
              <input
                type="number"
                min={1}
                step={1}
                value={lengthInput}
                onChange={(e) => setLengthInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyLength();
                }}
                className="w-full rounded border border-[#2c313a] bg-[#121417] px-2.5 py-1.5 text-xs tabular-nums text-white outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={applyLength}
                className="shrink-0 rounded bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
              >
                ОК
              </button>
            </div>
          </label>
        </div>

        {/* Координаты начала */}
        <div>
          <div className="mb-1 text-[11px] text-[#9aa2b1]">Координаты начала (мм)</div>
          <div className="grid grid-cols-3 gap-1.5">
            {(["x", "y", "z"] as const).map((axis) => (
              <label key={axis} className="text-[10px] uppercase text-[#6c7484]">
                {axis}
                <input
                  type="number"
                  value={selectedElement.start[axis]}
                  onChange={(e) => updateCoord("start", axis, e.target.value)}
                  className="mt-0.5 w-full rounded border border-[#2c313a] bg-[#121417] px-2 py-1 text-xs tabular-nums text-white outline-none focus:border-blue-500"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Координаты конца */}
        <div>
          <div className="mb-1 text-[11px] text-[#9aa2b1]">Координаты конца (мм)</div>
          <div className="grid grid-cols-3 gap-1.5">
            {(["x", "y", "z"] as const).map((axis) => (
              <label key={axis} className="text-[10px] uppercase text-[#6c7484]">
                {axis}
                <input
                  type="number"
                  value={selectedElement.end[axis]}
                  onChange={(e) => updateCoord("end", axis, e.target.value)}
                  className="mt-0.5 w-full rounded border border-[#2c313a] bg-[#121417] px-2 py-1 text-xs tabular-nums text-white outline-none focus:border-blue-500"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Выбор профиля */}
        <label className="block text-[11px] text-[#9aa2b1]">
          Тип профиля
          <select
            value={selectedElement.profileId}
            onChange={(e) =>
              updateElement(selectedElement.id, { profileId: e.target.value })
            }
            className="mt-1 w-full rounded border border-[#2c313a] bg-[#121417] px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500"
          >
            {project.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({formatMoney(p.pricePerMeter, project.calculationSettings.currency)}/м)
              </option>
            ))}
          </select>
        </label>

        {/* Цвет элемента */}
        <div className="flex items-center justify-between rounded border border-[#2c313a] bg-[#141619] px-2.5 py-2">
          <span className="text-xs text-[#c7cdd8]">Цвет отображения</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={effectiveColor}
              onChange={(e) =>
                updateElement(selectedElement.id, { color: e.target.value })
              }
              className="h-6 w-8 cursor-pointer rounded border border-[#2c313a] bg-transparent"
            />
            {selectedElement.color && (
              <button
                type="button"
                onClick={() =>
                  updateElement(selectedElement.id, { color: undefined })
                }
                className="text-[10px] text-[#9aa2b1] hover:text-white"
              >
                Сброс
              </button>
            )}
          </div>
        </div>

        {/* Исключение из покраски */}
        <label className="flex cursor-pointer items-center gap-2 rounded border border-[#2c313a] bg-[#141619] px-2.5 py-2 text-xs text-[#c7cdd8]">
          <input
            type="checkbox"
            checked={Boolean(selectedElement.excludeFromPainting)}
            onChange={(e) =>
              updateElement(selectedElement.id, {
                excludeFromPainting: e.target.checked,
              })
            }
            className="rounded border-[#3c4350] bg-[#121417]"
          />
          Исключить из расчёта покраски
        </label>

        {/* Стоимость металла элемента */}
        <div className="rounded border border-[#2c313a] bg-[#141619] p-2.5">
          <div className="text-[11px] text-[#9aa2b1]">Стоимость металла элемента</div>
          <div className="mt-1 text-base font-semibold tabular-nums text-white">
            {formatMoney(elementCost, project.calculationSettings.currency)}
          </div>
          <div className="mt-0.5 text-[10px] text-[#6c7484]">
            {mmToMeters(lengthMm).toFixed(3)} м ×{" "}
            {formatMoney(profile?.pricePerMeter ?? 0, project.calculationSettings.currency)}
          </div>
        </div>

        {/* Действия */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => duplicateElement(selectedElement.id)}
            className="inline-flex items-center justify-center gap-1.5 rounded border border-[#343a46] bg-[#22262d] py-1.5 text-xs text-[#e6e8ec] hover:bg-[#2c313a]"
          >
            <Copy className="h-3.5 w-3.5" />
            Копировать
          </button>
          <button
            type="button"
            onClick={() => deleteElements([selectedElement.id])}
            className="inline-flex items-center justify-center gap-1.5 rounded border border-rose-500/40 bg-rose-500/10 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Удалить
          </button>
        </div>
      </div>
    </aside>
  );
}

export function RightInspector() {
  const project = useProjectStore((s) => s.project);
  const selectedElementIds = useProjectStore((s) => s.selectedElementIds);

  const deleteElements = useProjectStore((s) => s.deleteElements);
  const copyElements = useProjectStore((s) => s.copyElements);
  const groupSelectedElements = useProjectStore((s) => s.groupSelectedElements);
  const ungroupSelectedElements = useProjectStore((s) => s.ungroupSelectedElements);
  const updateGridSettings = useProjectStore((s) => s.updateGridSettings);
  const updateCalculationSettings = useProjectStore((s) => s.updateCalculationSettings);

  const selectedElement =
    selectedElementIds.length === 1
      ? project.elements.find((el) => el.id === selectedElementIds[0]) ?? null
      : null;

  const estimate = calculateProjectEstimate(
    project.elements,
    project.profiles,
    project.joints,
    project.calculationSettings
  );

  // Режим просмотра свойств одного выбранного элемента
  if (selectedElement) {
    const lengthMm = roundMm(getElementLengthMm(selectedElement));
    return (
      <SelectedElementInspector
        key={`${selectedElement.id}:${lengthMm}`}
        selectedElement={selectedElement}
      />
    );
  }

  // Режим множественного выделения и работы с группой
  if (selectedElementIds.length > 1) {
    const selectedElements = project.elements.filter((el) =>
      selectedElementIds.includes(el.id)
    );
    const totalSelectedMeters = selectedElements.reduce(
      (sum, el) => sum + mmToMeters(getElementLengthMm(el)),
      0
    );
    const hasGrouped = selectedElements.some((el) => Boolean(el.groupId));
    const offsetStep = project.gridSettings.minorStepMm || 100;

    return (
      <aside className="flex w-80 shrink-0 flex-col border-l border-[#2c313a] bg-[#181b20] p-3 space-y-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#9aa2b1]">
            Выбрано элементов: {selectedElementIds.length}
          </div>
          <div className="mt-1 text-xs text-[#9aa2b1]">
            Суммарная длина:{" "}
            <strong className="tabular-nums text-[#e6e8ec]">
              {totalSelectedMeters.toFixed(2)} м
            </strong>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => groupSelectedElements()}
            className="inline-flex items-center justify-center gap-1.5 rounded border border-[#343a46] bg-[#22262d] py-1.5 text-xs text-[#e6e8ec] hover:bg-[#2c313a]"
          >
            <Group className="h-3.5 w-3.5 text-blue-400" />
            Сгруппировать
          </button>

          <button
            type="button"
            onClick={() => ungroupSelectedElements()}
            disabled={!hasGrouped}
            className="inline-flex items-center justify-center gap-1.5 rounded border border-[#343a46] bg-[#22262d] py-1.5 text-xs text-[#e6e8ec] hover:bg-[#2c313a] disabled:opacity-40"
          >
            <Ungroup className="h-3.5 w-3.5" />
            Разгруппировать
          </button>
        </div>

        <button
          type="button"
          onClick={() =>
            copyElements(selectedElementIds, {
              x: offsetStep,
              y: offsetStep,
              z: 0,
            })
          }
          className="inline-flex items-center justify-center gap-1.5 rounded border border-[#343a46] bg-[#22262d] py-2 text-xs text-[#e6e8ec] hover:bg-[#2c313a]"
        >
          <Copy className="h-3.5 w-3.5" />
          Копировать группу ({selectedElementIds.length})
        </button>

        <button
          type="button"
          onClick={() => deleteElements(selectedElementIds)}
          className="inline-flex items-center justify-center gap-1.5 rounded border border-rose-500/40 bg-rose-500/10 py-2 text-xs text-rose-300 hover:bg-rose-500/20"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Удалить выбранные ({selectedElementIds.length})
        </button>
      </aside>
    );
  }

  // Ничего не выбрано: общие параметры проекта, отображение и расчёт сметы
  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-[#2c313a] bg-[#181b20] overflow-y-auto">
      {/* Общие параметры проекта */}
      <section className="border-b border-[#2c313a] p-3">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#9aa2b1]">
          Параметры проекта
        </h2>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-[#9aa2b1]">Элементов:</span>
            <span className="tabular-nums text-[#e6e8ec]">{project.elements.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#9aa2b1]">Соединений:</span>
            <span className="tabular-nums text-[#e6e8ec]">{project.joints.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#9aa2b1]">Изменён:</span>
            <span className="tabular-nums text-[#9aa2b1]">
              {new Date(project.updatedAt).toLocaleTimeString("ru-RU", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      </section>

      {/* Настройки отображения и сетки */}
      <section className="border-b border-[#2c313a] p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <Sliders className="h-3.5 w-3.5 text-[#9aa2b1]" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#9aa2b1]">
            Отображение и сетка
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2.5">
          <label className="text-[10px] text-[#9aa2b1]">
            Основная сетка, мм
            <input
              type="number"
              min={50}
              step={50}
              value={project.gridSettings.majorStepMm}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val >= 50) updateGridSettings({ majorStepMm: val });
              }}
              className="mt-0.5 w-full rounded border border-[#2c313a] bg-[#121417] px-2 py-1 text-xs tabular-nums text-white outline-none"
            />
          </label>
          <label className="text-[10px] text-[#9aa2b1]">
            Мелкая сетка, мм
            <input
              type="number"
              min={10}
              step={10}
              value={project.gridSettings.minorStepMm}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val >= 10) updateGridSettings({ minorStepMm: val });
              }}
              className="mt-0.5 w-full rounded border border-[#2c313a] bg-[#121417] px-2 py-1 text-xs tabular-nums text-white outline-none"
            />
          </label>
        </div>

        <div className="space-y-1.5 text-xs text-[#c7cdd8]">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={project.gridSettings.showGrid}
              onChange={(e) => updateGridSettings({ showGrid: e.target.checked })}
            />
            Показывать сетку
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={project.gridSettings.showAxes}
              onChange={(e) => updateGridSettings({ showAxes: e.target.checked })}
            />
            Показывать оси координат
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={project.gridSettings.showDimensions}
              onChange={(e) => updateGridSettings({ showDimensions: e.target.checked })}
            />
            Подписи размеров (мм)
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={project.gridSettings.snapEnabled}
              onChange={(e) => updateGridSettings({ snapEnabled: e.target.checked })}
            />
            Включить привязки (общая)
          </label>
          {project.gridSettings.snapEnabled && (
            <div className="ml-4 space-y-1 border-l border-[#2c313a] pl-2.5 text-[11px] text-[#9aa2b1]">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={project.gridSettings.snapToGrid}
                  onChange={(e) => updateGridSettings({ snapToGrid: e.target.checked })}
                />
                К сетке ({project.gridSettings.minorStepMm} мм)
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={project.gridSettings.snapToEndpoints}
                  onChange={(e) =>
                    updateGridSettings({ snapToEndpoints: e.target.checked })
                  }
                />
                К концам линий
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={project.gridSettings.snapToIntersections}
                  onChange={(e) =>
                    updateGridSettings({ snapToIntersections: e.target.checked })
                  }
                />
                К пересечениям
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={project.gridSettings.snapToAngles}
                  onChange={(e) =>
                    updateGridSettings({ snapToAngles: e.target.checked })
                  }
                />
                К углам (шаг 45°)
              </label>
            </div>
          )}
        </div>
      </section>

      {/* Параметры расчёта и сметы */}
      <section className="p-3 space-y-3">
        <div className="flex items-center gap-1.5">
          <Calculator className="h-3.5 w-3.5 text-blue-400" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#9aa2b1]">
            Параметры расчёта
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-[#9aa2b1]">
            Валюта
            <select
              value={project.calculationSettings.currency}
              onChange={(e) =>
                updateCalculationSettings({
                  currency: e.target.value as CurrencyCode,
                })
              }
              className="mt-0.5 w-full rounded border border-[#2c313a] bg-[#121417] px-2 py-1 text-xs text-white outline-none"
            >
              <option value="RUB">RUB (₽)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="KZT">KZT (₸)</option>
              <option value="BYN">BYN (Br)</option>
            </select>
          </label>

          <label className="text-[10px] text-[#9aa2b1]">
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
              className="mt-0.5 w-full rounded border border-[#2c313a] bg-[#121417] px-2 py-1 text-xs tabular-nums text-white outline-none"
            />
          </label>
        </div>

        <div>
          <label className="block text-[10px] text-[#9aa2b1]">
            Способ расчёта сварки
            <select
              value={project.calculationSettings.weldPricingMode}
              onChange={(e) =>
                updateCalculationSettings({
                  weldPricingMode: e.target.value as WeldPricingMode,
                })
              }
              className="mt-0.5 w-full rounded border border-[#2c313a] bg-[#121417] px-2 py-1 text-xs text-white outline-none"
            >
              <option value="per_joint">За одно соединение</option>
              <option value="per_meter">За погонный метр шва</option>
            </select>
          </label>

          <label className="mt-2 block text-[10px] text-[#9aa2b1]">
            {project.calculationSettings.weldPricingMode === "per_joint"
              ? "Цена сварки за 1 соединение"
              : "Цена сварки за 1 м шва"}
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
              className="mt-0.5 w-full rounded border border-[#2c313a] bg-[#121417] px-2 py-1 text-xs tabular-nums text-white outline-none"
            />
          </label>
        </div>

        {/* Живая сводка сметы */}
        <div className="space-y-1.5 rounded border border-[#2c313a] bg-[#141619] p-2.5 text-xs">
          <div className="flex justify-between text-[#9aa2b1]">
            <span>Металл ({estimate.totalLengthMeters.toFixed(2)} м):</span>
            <span className="tabular-nums text-[#e6e8ec]">
              {formatMoney(estimate.metalCost, estimate.currency)}
            </span>
          </div>
          <div className="flex justify-between text-[#9aa2b1]">
            <span>Покраска ({estimate.paintableLengthMeters.toFixed(2)} м):</span>
            <span className="tabular-nums text-[#e6e8ec]">
              {formatMoney(estimate.paintingCost, estimate.currency)}
            </span>
          </div>
          <div className="flex justify-between text-[#9aa2b1]">
            <span>Сварка ({estimate.jointCount} соед.):</span>
            <span className="tabular-nums text-[#e6e8ec]">
              {formatMoney(estimate.weldingCost, estimate.currency)}
            </span>
          </div>
          <div className="border-t border-[#2c313a] pt-1.5 flex justify-between font-semibold text-white">
            <span>Итого:</span>
            <span className="tabular-nums text-blue-400">
              {formatMoney(estimate.totalCost, estimate.currency)}
            </span>
          </div>
        </div>
      </section>
    </aside>
  );
}
