"use client";

import { useState } from "react";
import { Copy, Group, Sliders, Trash2, Ungroup } from "lucide-react";
import { EstimatePanel } from "@/features/calculator/EstimatePanel";
import { JointsPanel, SelectedJointInspector } from "@/features/joints/JointsPanel";
import { formatMoney, roundMoney } from "@/lib/calculations/estimate";
import { getElementLengthMm, mmToMeters, roundMm } from "@/lib/geometry/elements";
import { useProjectStore } from "@/store/useProjectStore";
import type { ConstructionElement } from "@/types";

interface SelectedElementInspectorProps {
  selectedElement: ConstructionElement;
}

function SelectedElementInspector({ selectedElement }: SelectedElementInspectorProps) {
  const project = useProjectStore((s) => s.project);
  const updateElement = useProjectStore((s) => s.updateElement);
  const moveElements = useProjectStore((s) => s.moveElements);
  const resizeElementLength = useProjectStore((s) => s.resizeElementLength);
  const deleteElements = useProjectStore((s) => s.deleteElements);
  const duplicateElement = useProjectStore((s) => s.duplicateElement);

  const lengthMm = roundMm(getElementLengthMm(selectedElement));
  const [lengthInput, setLengthInput] = useState(String(lengthMm));
  const nudgeStep = project.gridSettings.minorStepMm || 100;

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
            {(
              [
                { axis: "x", color: "text-red-400" },
                { axis: "y", color: "text-emerald-400" },
                { axis: "z", color: "text-blue-400" },
              ] as const
            ).map(({ axis, color }) => (
              <label key={axis} className={`text-[10px] uppercase font-medium ${color}`}>
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
            {(
              [
                { axis: "x", color: "text-red-400" },
                { axis: "y", color: "text-emerald-400" },
                { axis: "z", color: "text-blue-400" },
              ] as const
            ).map(({ axis, color }) => (
              <label key={axis} className={`text-[10px] uppercase font-medium ${color}`}>
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

        {/* Быстрый сдвиг по осям X / Y / Z */}
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-[#9aa2b1]">
            <span>Сдвиг по осям</span>
            <span className="text-[10px] tabular-nums text-[#6c7484]">шаг {nudgeStep} мм</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { axis: "x", label: "X", color: "text-red-300" },
                { axis: "y", label: "Y", color: "text-emerald-300" },
                { axis: "z", label: "Z", color: "text-blue-300" },
              ] as const
            ).map(({ axis, label, color }) => (
              <div
                key={axis}
                className="flex items-center justify-between rounded border border-[#2c313a] bg-[#121417] px-1 py-0.5 text-[11px]"
              >
                <button
                  type="button"
                  onClick={() =>
                    moveElements([selectedElement.id], {
                      x: axis === "x" ? -nudgeStep : 0,
                      y: axis === "y" ? -nudgeStep : 0,
                      z: axis === "z" ? -nudgeStep : 0,
                    })
                  }
                  className="rounded px-1.5 py-0.5 text-[#9aa2b1] hover:bg-[#22262d] hover:text-white"
                  title={`Сдвинуть на -${nudgeStep} мм по ${label}`}
                >
                  −
                </button>
                <span className={`font-semibold ${color}`}>{label}</span>
                <button
                  type="button"
                  onClick={() =>
                    moveElements([selectedElement.id], {
                      x: axis === "x" ? nudgeStep : 0,
                      y: axis === "y" ? nudgeStep : 0,
                      z: axis === "z" ? nudgeStep : 0,
                    })
                  }
                  className="rounded px-1.5 py-0.5 text-[#9aa2b1] hover:bg-[#22262d] hover:text-white"
                  title={`Сдвинуть на +${nudgeStep} мм по ${label}`}
                >
                  +
                </button>
              </div>
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

interface MultiSelectionInspectorProps {
  selectedElementIds: string[];
}

function MultiSelectionInspector({ selectedElementIds }: MultiSelectionInspectorProps) {
  const project = useProjectStore((s) => s.project);
  const assignProfileToElements = useProjectStore((s) => s.assignProfileToElements);
  const groupSelectedElements = useProjectStore((s) => s.groupSelectedElements);
  const ungroupSelectedElements = useProjectStore((s) => s.ungroupSelectedElements);
  const moveElements = useProjectStore((s) => s.moveElements);
  const copyElements = useProjectStore((s) => s.copyElements);
  const deleteElements = useProjectStore((s) => s.deleteElements);

  const defaultStep = project.gridSettings.minorStepMm || 100;
  const [deltaX, setDeltaX] = useState("0");
  const [deltaY, setDeltaY] = useState("0");
  const [deltaZ, setDeltaZ] = useState(String(defaultStep));

  const selectedElements = project.elements.filter((el) =>
    selectedElementIds.includes(el.id)
  );
  const totalSelectedMeters = selectedElements.reduce(
    (sum, el) => sum + mmToMeters(getElementLengthMm(el)),
    0
  );
  const hasGrouped = selectedElements.some((el) => Boolean(el.groupId));

  const parsedDelta = () => ({
    x: Number(deltaX) || 0,
    y: Number(deltaY) || 0,
    z: Number(deltaZ) || 0,
  });

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-[#2c313a] bg-[#181b20] p-3 space-y-3 overflow-y-auto">
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

      <label className="block text-[11px] text-[#9aa2b1]">
        Назначить профиль всем выбранным
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) {
              assignProfileToElements(selectedElementIds, e.target.value);
              e.target.value = "";
            }
          }}
          className="mt-1 w-full rounded border border-[#2c313a] bg-[#121417] px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500"
        >
          <option value="" disabled>
            Выберите профиль...
          </option>
          {project.profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({formatMoney(p.pricePerMeter, project.calculationSettings.currency)}/м)
            </option>
          ))}
        </select>
      </label>

      {/* Сдвиг или копирование группы по осям X / Y / Z */}
      <div className="rounded border border-[#2c313a] bg-[#141619] p-2.5 space-y-2">
        <div className="text-[11px] font-medium text-[#c7cdd8]">
          Сдвиг / копия по осям (мм)
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <label className="text-[10px] font-medium text-red-400">
            ΔX
            <input
              type="number"
              value={deltaX}
              onChange={(e) => setDeltaX(e.target.value)}
              className="mt-0.5 w-full rounded border border-[#2c313a] bg-[#121417] px-1.5 py-1 text-xs tabular-nums text-white outline-none focus:border-blue-500"
            />
          </label>
          <label className="text-[10px] font-medium text-emerald-400">
            ΔY
            <input
              type="number"
              value={deltaY}
              onChange={(e) => setDeltaY(e.target.value)}
              className="mt-0.5 w-full rounded border border-[#2c313a] bg-[#121417] px-1.5 py-1 text-xs tabular-nums text-white outline-none focus:border-blue-500"
            />
          </label>
          <label className="text-[10px] font-medium text-blue-400">
            ΔZ (выс.)
            <input
              type="number"
              value={deltaZ}
              onChange={(e) => setDeltaZ(e.target.value)}
              className="mt-0.5 w-full rounded border border-[#2c313a] bg-[#121417] px-1.5 py-1 text-xs tabular-nums text-white outline-none focus:border-blue-500"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => moveElements(selectedElementIds, parsedDelta())}
            className="rounded border border-[#343a46] bg-[#22262d] py-1.5 text-xs text-[#e6e8ec] hover:bg-[#2c313a]"
          >
            Сдвинуть
          </button>
          <button
            type="button"
            onClick={() => copyElements(selectedElementIds, parsedDelta())}
            className="inline-flex items-center justify-center gap-1 rounded bg-blue-600/20 border border-blue-500/40 py-1.5 text-xs text-blue-200 hover:bg-blue-600/30"
          >
            <Copy className="h-3 w-3" />
            Копировать
          </button>
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
        onClick={() => deleteElements(selectedElementIds)}
        className="inline-flex items-center justify-center gap-1.5 rounded border border-rose-500/40 bg-rose-500/10 py-2 text-xs text-rose-300 hover:bg-rose-500/20"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Удалить выбранные ({selectedElementIds.length})
      </button>
    </aside>
  );
}

type InspectorTab = "estimate" | "joints" | "grid";

export function RightInspector() {
  const project = useProjectStore((s) => s.project);
  const selectedElementIds = useProjectStore((s) => s.selectedElementIds);
  const selectedJointId = useProjectStore((s) => s.selectedJointId);

  const updateGridSettings = useProjectStore((s) => s.updateGridSettings);

  const [activeTab, setActiveTab] = useState<InspectorTab>("estimate");

  const selectedElement =
    selectedElementIds.length === 1
      ? project.elements.find((el) => el.id === selectedElementIds[0]) ?? null
      : null;

  const selectedJoint = selectedJointId
    ? project.joints.find((j) => j.id === selectedJointId) ?? null
    : null;

  // Режим просмотра выбранного узла соединения
  if (selectedJoint) {
    return <SelectedJointInspector joint={selectedJoint} />;
  }

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
    return <MultiSelectionInspector selectedElementIds={selectedElementIds} />;
  }

  // Ничего не выбрано: вкладки Смета / Соединения / Сетка и проект
  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-[#2c313a] bg-[#181b20] overflow-hidden">
      <div className="grid grid-cols-3 border-b border-[#2c313a] bg-[#141619] p-1">
        {(
          [
            { id: "estimate", label: "Смета" },
            { id: "joints", label: `Стыки (${project.joints.length})` },
            { id: "grid", label: "Сетка" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded py-1.5 text-[11px] font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-[#22262d] text-white shadow-xs"
                : "text-[#9aa2b1] hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "estimate" && <EstimatePanel />}
        {activeTab === "joints" && <JointsPanel />}
        {activeTab === "grid" && (
          <div>
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
            <section className="p-3">
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
          </div>
        )}
      </div>
    </aside>
  );
}
