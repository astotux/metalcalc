"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Box,
  Download,
  FilePlus2,
  FolderOpen,
  Layers,
  Redo2,
  Save,
  Settings,
  Undo2,
} from "lucide-react";
import { EstimateModal } from "@/components/common/EstimateModal";
import { useProjectStore } from "@/store/useProjectStore";

export function TopToolbar() {
  const project = useProjectStore((s) => s.project);
  const saveStatus = useProjectStore((s) => s.saveStatus);
  const historyPastCount = useProjectStore((s) => s.historyPast.length);
  const historyFutureCount = useProjectStore((s) => s.historyFuture.length);

  const renameProject = useProjectStore((s) => s.renameProject);
  const createNewProject = useProjectStore((s) => s.createNewProject);
  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const setViewMode = useProjectStore((s) => s.setViewMode);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(project.name);
  const [estimateOpen, setEstimateOpen] = useState(false);

  const viewMode = project.displaySettings.viewMode;

  const commitTitle = () => {
    setIsEditingTitle(false);
    if (titleDraft.trim() && titleDraft.trim() !== project.name) {
      renameProject(titleDraft);
    } else {
      setTitleDraft(project.name);
    }
  };

  const handleCreateProject = () => {
    createNewProject(`Проект от ${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`);
  };

  return (
    <>
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#2c313a] bg-[#181b20] px-3">
        {/* Левая группа: логотип, название и файловые операции */}
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-[#23272f]"
            title="MetalCalc"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white">
              MC
            </div>
            <span className="hidden text-sm font-semibold tracking-tight text-white sm:inline">
              MetalCalc
            </span>
          </Link>

          <div className="h-5 w-px bg-[#2c313a]" />

          {/* Название проекта */}
          <div className="flex items-center gap-1.5 min-w-0">
            {isEditingTitle ? (
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitTitle();
                  if (e.key === "Escape") {
                    setTitleDraft(project.name);
                    setIsEditingTitle(false);
                  }
                }}
                autoFocus
                className="w-48 rounded border border-blue-500 bg-[#121417] px-2 py-0.5 text-xs text-white outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTitleDraft(project.name);
                  setIsEditingTitle(true);
                }}
                className="truncate max-w-[200px] rounded px-2 py-1 text-xs font-medium text-[#e6e8ec] hover:bg-[#23272f]"
                title="Нажмите, чтобы переименовать проект"
              >
                {project.name}
              </button>
            )}

            {project.isExample && (
              <span className="hidden rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 md:inline">
                Пример
              </span>
            )}
          </div>

          <div className="h-5 w-px bg-[#2c313a]" />

          {/* Операции с проектом */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCreateProject}
              className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-[#c7cdd8] hover:bg-[#252a33] hover:text-white"
              title="Создать новый проект"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Создать</span>
            </button>

            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-[#c7cdd8] hover:bg-[#252a33] hover:text-white"
              title="Открыть список проектов"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Открыть</span>
            </Link>

            <button
              type="button"
              onClick={() => saveCurrentProject()}
              className={`inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors ${
                saveStatus === "unsaved"
                  ? "bg-blue-600/20 text-blue-300 hover:bg-blue-600/30"
                  : "text-[#c7cdd8] hover:bg-[#252a33] hover:text-white"
              }`}
              title="Сохранить проект"
            >
              <Save className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Сохранить</span>
            </button>
          </div>
        </div>

        {/* Центральная группа: Отмена / Повтор и 2D / 3D */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded border border-[#2c313a] bg-[#141619] p-0.5">
            <button
              type="button"
              onClick={undo}
              disabled={historyPastCount === 0}
              className="rounded p-1 text-[#c7cdd8] hover:bg-[#252a33] disabled:opacity-35 disabled:hover:bg-transparent"
              title="Отменить (Undo)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={historyFutureCount === 0}
              className="rounded p-1 text-[#c7cdd8] hover:bg-[#252a33] disabled:opacity-35 disabled:hover:bg-transparent"
              title="Повторить (Redo)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div
            className="flex items-center rounded border border-[#2c313a] bg-[#141619] p-0.5"
            role="group"
            aria-label="Режим отображения"
          >
            <button
              type="button"
              onClick={() => setViewMode("2d")}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === "2d"
                  ? "bg-blue-600 text-white"
                  : "text-[#9aa2b1] hover:text-white"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              2D
            </button>
            <button
              type="button"
              onClick={() => setViewMode("3d")}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === "3d"
                  ? "bg-blue-600 text-white"
                  : "text-[#9aa2b1] hover:text-white"
              }`}
            >
              <Box className="h-3.5 w-3.5" />
              3D
            </button>
          </div>
        </div>

        {/* Правая группа: Настройки и Экспорт / Смета */}
        <div className="flex items-center gap-1.5">
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-[#c7cdd8] hover:bg-[#252a33] hover:text-white"
            title="Настройки расчётов и интерфейса"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Настройки</span>
          </Link>

          <button
            type="button"
            onClick={() => setEstimateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded border border-[#343a46] bg-[#22262d] px-2.5 py-1.5 text-xs font-medium text-[#e6e8ec] hover:bg-[#2c313a]"
            title="Открыть смету и экспорт"
          >
            <Download className="h-3.5 w-3.5 text-blue-400" />
            <span>Экспорт / Смета</span>
          </button>
        </div>
      </header>

      <EstimateModal open={estimateOpen} onClose={() => setEstimateOpen(false)} />
    </>
  );
}
