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
    <aside className="flex h-full w-full flex-col overflow-y-auto bg-[var(--mc-bg-panel)]">
      <div className="border-b border-[var(--mc-border)] px-3 py-2.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mc-text-muted)]">
          Свойства элемента
        </div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--mc-text-subtle)]">
          ID: {selectedElement.id}
        </div>
      </div>

      <div className="space-y-4 p-3">
        {/* Метка элемента */}
        <label className="block text-[11px] text-[var(--mc-text-muted)]">
          Название / пометка
          <input
            type="text"
            value={selectedElement.label ?? ""}
            onChange={(e) =>
              updateElement(selectedElement.id, { label: e.target.value })
            }
            placeholder="Например: Стойка левая"
            className="mt-1 w-full rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2.5 py-1.5 text-xs text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-light)]"
          />
        </label>

        {/* Точная длина в миллиметрах */}
        <div>
          <label className="block text-[11px] text-[var(--mc-text-muted)]">
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
                className="w-full rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2.5 py-1.5 font-mono text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-light)]"
              />
              <button
                type="button"
                onClick={applyLength}
                className="shrink-0 rounded-md bg-[var(--mc-brand)] px-3 py-1.5 text-xs font-medium text-[var(--mc-brand-text)] transition-colors hover:bg-[var(--mc-brand-light)]"
              >
                ОК
              </button>
            </div>
          </label>
        </div>

        {/* Координаты начала */}
        <div>
          <div className="mb-1 text-[11px] text-[var(--mc-text-muted)]">Координаты начала (мм)</div>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { axis: "x", color: "text-red-400" },
                { axis: "y", color: "text-emerald-500" },
                { axis: "z", color: "text-sky-400" },
              ] as const
            ).map(({ axis, color }) => (
              <label key={axis} className={`text-[10px] font-semibold uppercase ${color}`}>
                {axis}
                <input
                  type="number"
                  value={selectedElement.start[axis]}
                  onChange={(e) => updateCoord("start", axis, e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2 py-1 font-mono text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-light)]"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Координаты конца */}
        <div>
          <div className="mb-1 text-[11px] text-[var(--mc-text-muted)]">Координаты конца (мм)</div>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { axis: "x", color: "text-red-400" },
                { axis: "y", color: "text-emerald-500" },
                { axis: "z", color: "text-sky-400" },
              ] as const
            ).map(({ axis, color }) => (
              <label key={axis} className={`text-[10px] font-semibold uppercase ${color}`}>
                {axis}
                <input
                  type="number"
                  value={selectedElement.end[axis]}
                  onChange={(e) => updateCoord("end", axis, e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2 py-1 font-mono text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-light)]"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Быстрый сдвиг по осям X / Y / Z */}
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--mc-text-muted)]">
            <span>Сдвиг по осям</span>
            <span className="font-mono text-[10px] tabular-nums text-[var(--mc-text-subtle)]">
              шаг {nudgeStep} мм
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { axis: "x", label: "X", color: "text-red-400" },
                { axis: "y", label: "Y", color: "text-emerald-500" },
                { axis: "z", label: "Z", color: "text-sky-400" },
              ] as const
            ).map(({ axis, label, color }) => (
              <div
                key={axis}
                className="flex items-center justify-between rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-1 py-0.5 text-[11px]"
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
                  className="rounded px-1.5 py-0.5 text-[var(--mc-text-muted)] transition-colors hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
                  title={`Сдвинуть на -${nudgeStep} мм по ${label}`}
                >
                  −
                </button>
                <span className={`font-mono font-semibold ${color}`}>{label}</span>
                <button
                  type="button"
                  onClick={() =>
                    moveElements([selectedElement.id], {
                      x: axis === "x" ? nudgeStep : 0,
                      y: axis === "y" ? nudgeStep : 0,
                      z: axis === "z" ? nudgeStep : 0,
                    })
                  }
                  className="rounded px-1.5 py-0.5 text-[var(--mc-text-muted)] transition-colors hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
                  title={`Сдвинуть на +${nudgeStep} мм по ${label}`}
                >
                  +
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Выбор профиля */}
        <label className="block text-[11px] text-[var(--mc-text-muted)]">
          Тип профиля
          <select
            value={selectedElement.profileId}
            onChange={(e) =>
              updateElement(selectedElement.id, { profileId: e.target.value })
            }
            className="mt-1 w-full rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2 py-1.5 text-xs text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-light)]"
          >
            {project.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({formatMoney(p.pricePerMeter, project.calculationSettings.currency)}/м)
              </option>
            ))}
          </select>
        </label>

        {/* Цвет элемента */}
        <div className="flex items-center justify-between rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-app)] px-2.5 py-2">
          <span className="text-xs text-[var(--mc-text-secondary)]">Цвет отображения</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={effectiveColor}
              onChange={(e) =>
                updateElement(selectedElement.id, { color: e.target.value })
              }
              className="h-6 w-8 cursor-pointer rounded border border-[var(--mc-border)] bg-transparent"
            />
            {selectedElement.color && (
              <button
                type="button"
                onClick={() =>
                  updateElement(selectedElement.id, { color: undefined })
                }
                className="text-[10px] text-[var(--mc-text-muted)] hover:text-[var(--mc-text)]"
              >
                Сброс
              </button>
            )}
          </div>
        </div>

        {/* Исключение из покраски */}
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-app)] px-2.5 py-2 text-xs text-[var(--mc-text-secondary)]">
          <input
            type="checkbox"
            checked={Boolean(selectedElement.excludeFromPainting)}
            onChange={(e) =>
              updateElement(selectedElement.id, {
                excludeFromPainting: e.target.checked,
              })
            }
            className="rounded border-[var(--mc-border-strong)] bg-[var(--mc-bg-input)] accent-[var(--mc-brand)]"
          />
          Исключить из расчёта покраски
        </label>

        {/* Стоимость металла элемента */}
        <div className="rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-app)] p-2.5">
          <div className="text-[11px] text-[var(--mc-text-muted)]">Стоимость металла элемента</div>
          <div className="mt-1 font-mono text-base font-semibold tabular-nums text-[var(--mc-brand-inline)]">
            {formatMoney(elementCost, project.calculationSettings.currency)}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[var(--mc-text-subtle)]">
            {mmToMeters(lengthMm).toFixed(3)} м ×{" "}
            {formatMoney(profile?.pricePerMeter ?? 0, project.calculationSettings.currency)}
          </div>
        </div>

        {/* Действия */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => duplicateElement(selectedElement.id)}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] py-1.5 text-xs font-medium text-[var(--mc-text)] transition-colors hover:bg-[var(--mc-bg-hover)]"
          >
            <Copy className="h-3.5 w-3.5" />
            Копировать
          </button>
          <button
            type="button"
            onClick={() => deleteElements([selectedElement.id])}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--mc-danger-border)] bg-[var(--mc-danger-soft)] py-1.5 text-xs font-medium text-[var(--mc-danger-text)] transition-colors hover:opacity-85"
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
    <aside className="flex h-full w-full flex-col space-y-3 overflow-y-auto bg-[var(--mc-bg-panel)] p-3">
      <div className="border-b border-[var(--mc-border)] pb-2.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mc-text-muted)]">
          Выбрано элементов: {selectedElementIds.length}
        </div>
        <div className="mt-1 text-xs text-[var(--mc-text-muted)]">
          Суммарная длина:{" "}
          <strong className="font-mono tabular-nums text-[var(--mc-text)]">
            {totalSelectedMeters.toFixed(2)} м
          </strong>
        </div>
      </div>

      <label className="block text-[11px] text-[var(--mc-text-muted)]">
        Назначить профиль всем выбранным
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) {
              assignProfileToElements(selectedElementIds, e.target.value);
              e.target.value = "";
            }
          }}
          className="mt-1 w-full rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2 py-1.5 text-xs text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-light)]"
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
      <div className="space-y-2 rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-app)] p-2.5">
        <div className="text-[11px] font-medium text-[var(--mc-text-secondary)]">
          Сдвиг / копия по осям (мм)
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <label className="text-[10px] font-medium text-red-400">
            ΔX
            <input
              type="number"
              value={deltaX}
              onChange={(e) => setDeltaX(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-1.5 py-1 font-mono text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-light)]"
            />
          </label>
          <label className="text-[10px] font-medium text-emerald-500">
            ΔY
            <input
              type="number"
              value={deltaY}
              onChange={(e) => setDeltaY(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-1.5 py-1 font-mono text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-light)]"
            />
          </label>
          <label className="text-[10px] font-medium text-sky-400">
            ΔZ (выс.)
            <input
              type="number"
              value={deltaZ}
              onChange={(e) => setDeltaZ(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-1.5 py-1 font-mono text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-light)]"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => moveElements(selectedElementIds, parsedDelta())}
            className="rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] py-1.5 text-xs font-medium text-[var(--mc-text)] transition-colors hover:bg-[var(--mc-bg-hover)]"
          >
            Сдвинуть
          </button>
          <button
            type="button"
            onClick={() => copyElements(selectedElementIds, parsedDelta())}
            className="inline-flex items-center justify-center gap-1 rounded-md border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] py-1.5 text-xs font-medium text-[var(--mc-brand-inline)] transition-colors hover:bg-[var(--mc-brand)] hover:text-[var(--mc-brand-text)]"
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
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] py-1.5 text-xs font-medium text-[var(--mc-text)] transition-colors hover:bg-[var(--mc-bg-hover)]"
        >
          <Group className="h-3.5 w-3.5 text-[var(--mc-brand-light)]" />
          Сгруппировать
        </button>

        <button
          type="button"
          onClick={() => ungroupSelectedElements()}
          disabled={!hasGrouped}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] py-1.5 text-xs font-medium text-[var(--mc-text)] transition-colors hover:bg-[var(--mc-bg-hover)] disabled:opacity-40"
        >
          <Ungroup className="h-3.5 w-3.5" />
          Разгруппировать
        </button>
      </div>

      <button
        type="button"
        onClick={() => deleteElements(selectedElementIds)}
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--mc-danger-border)] bg-[var(--mc-danger-soft)] py-2 text-xs font-medium text-[var(--mc-danger-text)] transition-colors hover:opacity-85"
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

  if (selectedJoint) {
    return <SelectedJointInspector joint={selectedJoint} />;
  }

  if (selectedElement) {
    const lengthMm = roundMm(getElementLengthMm(selectedElement));
    return (
      <SelectedElementInspector
        key={`${selectedElement.id}:${lengthMm}`}
        selectedElement={selectedElement}
      />
    );
  }

  if (selectedElementIds.length > 1) {
    return <MultiSelectionInspector selectedElementIds={selectedElementIds} />;
  }

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-[var(--mc-bg-panel)]">
      <div
        className="grid grid-cols-3 gap-1 border-b border-[var(--mc-border)] bg-[var(--mc-bg-app)] p-1"
        role="tablist"
        aria-label="Вкладки инспектора"
      >
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
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md py-1.5 text-[11px] font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-[var(--mc-brand)] text-[var(--mc-brand-text)] shadow-xs"
                : "text-[var(--mc-text-muted)] hover:text-[var(--mc-text)]"
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
            <section className="border-b border-[var(--mc-border)] p-3">
              <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--mc-text-muted)]">
                Параметры проекта
              </h2>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--mc-text-muted)]">Элементов:</span>
                  <span className="font-mono tabular-nums text-[var(--mc-text)]">
                    {project.elements.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--mc-text-muted)]">Соединений:</span>
                  <span className="font-mono tabular-nums text-[var(--mc-text)]">
                    {project.joints.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--mc-text-muted)]">Изменён:</span>
                  <span className="font-mono tabular-nums text-[var(--mc-text-muted)]">
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
                <Sliders className="h-3.5 w-3.5 text-[var(--mc-text-muted)]" />
                <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mc-text-muted)]">
                  Отображение и сетка
                </h2>
              </div>

              <div className="mb-2.5 grid grid-cols-2 gap-2">
                <label className="text-[10px] text-[var(--mc-text-muted)]">
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
                    className="mt-0.5 w-full rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2 py-1 font-mono text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-light)]"
                  />
                </label>
                <label className="text-[10px] text-[var(--mc-text-muted)]">
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
                    className="mt-0.5 w-full rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2 py-1 font-mono text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-light)]"
                  />
                </label>
              </div>

              <div className="space-y-1.5 text-xs text-[var(--mc-text-secondary)]">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={project.gridSettings.showGrid}
                    onChange={(e) => updateGridSettings({ showGrid: e.target.checked })}
                    className="accent-[var(--mc-brand)]"
                  />
                  Показывать сетку
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={project.gridSettings.showAxes}
                    onChange={(e) => updateGridSettings({ showAxes: e.target.checked })}
                    className="accent-[var(--mc-brand)]"
                  />
                  Показывать оси координат
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={project.gridSettings.showDimensions}
                    onChange={(e) => updateGridSettings({ showDimensions: e.target.checked })}
                    className="accent-[var(--mc-brand)]"
                  />
                  Подписи размеров (мм)
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={project.gridSettings.snapEnabled}
                    onChange={(e) => updateGridSettings({ snapEnabled: e.target.checked })}
                    className="accent-[var(--mc-brand)]"
                  />
                  Включить привязки (общая)
                </label>
                {project.gridSettings.snapEnabled && (
                  <div className="ml-4 space-y-1 border-l border-[var(--mc-border)] pl-2.5 text-[11px] text-[var(--mc-text-muted)]">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={project.gridSettings.snapToGrid}
                        onChange={(e) => updateGridSettings({ snapToGrid: e.target.checked })}
                        className="accent-[var(--mc-brand)]"
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
                        className="accent-[var(--mc-brand)]"
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
                        className="accent-[var(--mc-brand)]"
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
                        className="accent-[var(--mc-brand)]"
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
