"use client";

import { Crosshair, GitCommitHorizontal, Plus, Ruler, Trash2 } from "lucide-react";
import {
  estimateJointPerimeterWeldMm,
  JOINT_TYPE_LABELS,
} from "@/features/joints/detectJoints";
import { useProjectStore } from "@/store/useProjectStore";
import type { JointConnection, JointType } from "@/types";

export function JointsPanel() {
  const project = useProjectStore((s) => s.project);
  const selectedJointId = useProjectStore((s) => s.selectedJointId);
  const selectJoint = useProjectStore((s) => s.selectJoint);
  const detectAndSyncJoints = useProjectStore((s) => s.detectAndSyncJoints);
  const addManualJoint = useProjectStore((s) => s.addManualJoint);
  const deleteJoint = useProjectStore((s) => s.deleteJoint);
  const estimateAllWeldLengthsByPerimeter = useProjectStore(
    (s) => s.estimateAllWeldLengthsByPerimeter
  );
  const setShowJoints = useProjectStore((s) => s.setShowJoints);

  const handleAddManual = () => {
    addManualJoint({
      type: "butt",
      elementIds: project.elements.slice(0, 2).map((el) => el.id),
      position: { x: 0, y: 0, z: 0 },
      weldLengthMm: null,
      processingNotes: "Добавлено вручную",
    });
  };

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <GitCommitHorizontal className="h-3.5 w-3.5 text-amber-400" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#9aa2b1]">
            Соединения ({project.joints.length})
          </h2>
        </div>

        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[#9aa2b1]">
          <input
            type="checkbox"
            checked={project.displaySettings.showJoints}
            onChange={(e) => setShowJoints(e.target.checked)}
          />
          На чертеже
        </label>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => detectAndSyncJoints()}
          className="inline-flex items-center justify-center gap-1.5 rounded border border-blue-500/40 bg-blue-600/15 px-2 py-1.5 text-[11px] font-medium text-blue-200 hover:bg-blue-600/25"
          title="Найти угловые, Т-образные и нахлёстные стыки по текущей геометрии"
        >
          <Crosshair className="h-3.5 w-3.5" />
          Найти стыки
        </button>

        <button
          type="button"
          onClick={handleAddManual}
          className="inline-flex items-center justify-center gap-1.5 rounded border border-[#343a46] bg-[#22262d] px-2 py-1.5 text-[11px] text-[#e6e8ec] hover:bg-[#2c313a]"
        >
          <Plus className="h-3.5 w-3.5" />
          Добавить узел
        </button>
      </div>

      {project.joints.some((j) => j.weldLengthMm === null) && (
        <button
          type="button"
          onClick={() => estimateAllWeldLengthsByPerimeter()}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-amber-500/35 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200 hover:bg-amber-500/20"
          title="Заполнить пустые длины швов как периметр сечения профиля 2×(Ш+В)"
        >
          <Ruler className="h-3.5 w-3.5" />
          Оценить длину швов по сечению
        </button>
      )}

      {project.joints.length === 0 ? (
        <div className="rounded border border-[#2c313a] bg-[#141619] p-4 text-center text-xs text-[#6c7484]">
          Узлы соединений не добавлены. Нажмите «Найти стыки» после построения конструкции.
        </div>
      ) : (
        <div className="space-y-1.5">
          {project.joints.map((joint) => {
            const isSelected = selectedJointId === joint.id;
            return (
              <div
                key={joint.id}
                className={`flex items-center justify-between gap-2 rounded border px-2.5 py-2 text-xs transition-colors ${
                  isSelected
                    ? "border-blue-500 bg-blue-600/15"
                    : "border-[#262a32] bg-[#141619] hover:border-[#3c4350]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectJoint(joint.id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                    <span className="truncate font-medium text-[#e6e8ec]">
                      {JOINT_TYPE_LABELS[joint.type]}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-[#9aa2b1] tabular-nums">
                    ({joint.position.x}, {joint.position.y}) мм · Шов:{" "}
                    {joint.weldLengthMm !== null ? `${joint.weldLengthMm} мм` : "не задан"}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => deleteJoint(joint.id)}
                  className="rounded p-1 text-[#6c7484] hover:bg-rose-500/15 hover:text-rose-300"
                  title="Удалить соединение"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface SelectedJointInspectorProps {
  joint: JointConnection;
}

export function SelectedJointInspector({ joint }: SelectedJointInspectorProps) {
  const project = useProjectStore((s) => s.project);
  const updateJoint = useProjectStore((s) => s.updateJoint);
  const deleteJoint = useProjectStore((s) => s.deleteJoint);
  const selectJoint = useProjectStore((s) => s.selectJoint);

  const estimatedMm = estimateJointPerimeterWeldMm(
    joint,
    project.elements,
    project.profiles
  );

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-[#2c313a] bg-[#181b20] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-[#2c313a] px-3 py-2.5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
            Узел соединения
          </div>
          <div className="mt-0.5 text-xs text-[#6c7484]">
            ({joint.position.x}, {joint.position.y}, {joint.position.z}) мм
          </div>
        </div>
        <button
          type="button"
          onClick={() => selectJoint(null)}
          className="rounded px-2 py-1 text-[11px] text-[#9aa2b1] hover:bg-[#252a33] hover:text-white"
        >
          Назад
        </button>
      </div>

      <div className="space-y-4 p-3">
        <label className="block text-[11px] text-[#9aa2b1]">
          Тип соединения
          <select
            value={joint.type}
            onChange={(e) =>
              updateJoint(joint.id, { type: e.target.value as JointType })
            }
            className="mt-1 w-full rounded border border-[#2c313a] bg-[#121417] px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500"
          >
            {(Object.keys(JOINT_TYPE_LABELS) as JointType[]).map((type) => (
              <option key={type} value={type}>
                {JOINT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <div>
          <label className="block text-[11px] text-[#9aa2b1]">
            Длина сварного шва (мм)
            <div className="mt-1 flex gap-1.5">
              <input
                type="number"
                min={0}
                step={5}
                placeholder="Не задана"
                value={joint.weldLengthMm ?? ""}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  if (val === "") {
                    updateJoint(joint.id, { weldLengthMm: null });
                    return;
                  }
                  const num = Number(val);
                  if (Number.isFinite(num) && num >= 0) {
                    updateJoint(joint.id, { weldLengthMm: num });
                  }
                }}
                className="w-full rounded border border-[#2c313a] bg-[#121417] px-2.5 py-1.5 text-xs tabular-nums text-white outline-none focus:border-blue-500"
              />
              {estimatedMm !== null && (
                <button
                  type="button"
                  onClick={() => updateJoint(joint.id, { weldLengthMm: estimatedMm })}
                  className="shrink-0 rounded border border-[#343a46] bg-[#22262d] px-2 py-1.5 text-[11px] text-[#e6e8ec] hover:bg-[#2c313a]"
                  title="Подставить периметр меньшего профиля 2×(Ш+В)"
                >
                  ~{estimatedMm} мм
                </button>
              )}
            </div>
          </label>
          <p className="mt-1 text-[10px] text-[#6c7484]">
            Длина шва не приравнивается к длине трубы: задаётся вручную или оценивается по периметру сечения.
          </p>
        </div>

        <label className="block text-[11px] text-[#9aa2b1]">
          Угол реза (градусы)
          <input
            type="number"
            min={0}
            max={90}
            step={0.5}
            placeholder="Например: 45"
            value={joint.cutAngleDeg ?? ""}
            onChange={(e) => {
              const val = e.target.value.trim();
              updateJoint(joint.id, {
                cutAngleDeg: val === "" ? undefined : Number(val),
              });
            }}
            className="mt-1 w-full rounded border border-[#2c313a] bg-[#121417] px-2.5 py-1.5 text-xs tabular-nums text-white outline-none focus:border-blue-500"
          />
        </label>

        <label className="block text-[11px] text-[#9aa2b1]">
          Параметры обработки / примечание
          <textarea
            rows={2}
            value={joint.processingNotes ?? ""}
            onChange={(e) =>
              updateJoint(joint.id, { processingNotes: e.target.value })
            }
            placeholder="Зачистка шва, провар с 4 сторон..."
            className="mt-1 w-full rounded border border-[#2c313a] bg-[#121417] px-2.5 py-1.5 text-xs text-white outline-none focus:border-blue-500"
          />
        </label>

        <div className="rounded border border-[#2c313a] bg-[#141619] p-2.5 text-[11px] text-[#9aa2b1]">
          Связано элементов: <strong className="text-white">{joint.elementIds.length}</strong>
        </div>

        <button
          type="button"
          onClick={() => deleteJoint(joint.id)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-rose-500/40 bg-rose-500/10 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Удалить соединение
        </button>
      </div>
    </aside>
  );
}
