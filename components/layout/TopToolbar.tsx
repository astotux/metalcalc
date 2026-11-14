"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Box,
  Download,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Layers,
  Loader2,
  Moon,
  Redo2,
  Save,
  Settings,
  Sun,
  Undo2,
} from "lucide-react";
import { EstimateModal } from "@/components/common/EstimateModal";
import { AccountHeaderBadge } from "@/components/auth/AccountHeaderBadge";
import { downloadProjectExcel, downloadProjectPdf } from "@/features/export/exportClient";
import { useProjectStore } from "@/store/useProjectStore";
import { useThemeStore } from "@/store/useThemeStore";

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
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(project.name);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<"pdf" | "excel" | null>(null);

  const handleQuickExport = async (format: "pdf" | "excel") => {
    setExportingFormat(format);
    try {
      if (format === "pdf") {
        await downloadProjectPdf(project);
      } else {
        await downloadProjectExcel(project);
      }
    } catch (error) {
      useProjectStore.setState({
        saveStatus: "error",
        lastError:
          error instanceof Error ? error.message : "Ошибка экспорта документа",
      });
    } finally {
      setExportingFormat(null);
    }
  };

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
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--mc-border)] bg-[var(--mc-bg-panel)] px-3">
        {/* Левая группа: логотип, название и файловые операции */}
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-[var(--mc-bg-hover)]"
            title="MetalCalc"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--mc-brand)] text-xs font-bold text-[var(--mc-brand-text)] shadow-xs">
              MC
            </div>
            <span className="hidden text-sm font-semibold tracking-tight text-[var(--mc-text)] sm:inline">
              MetalCalc
            </span>
          </Link>

          <div className="h-5 w-px bg-[var(--mc-border)]" />

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
                className="w-48 rounded border border-[var(--mc-brand-light)] bg-[var(--mc-bg-input)] px-2 py-0.5 text-xs text-[var(--mc-text)] outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTitleDraft(project.name);
                  setIsEditingTitle(true);
                }}
                className="truncate max-w-[200px] rounded px-2 py-1 text-xs font-medium text-[var(--mc-text)] hover:bg-[var(--mc-bg-hover)]"
                title="Нажмите, чтобы переименовать проект"
              >
                {project.name}
              </button>
            )}

            {project.isExample && (
              <span className="hidden rounded border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--mc-brand-inline)] md:inline">
                Пример
              </span>
            )}
          </div>

          <div className="h-5 w-px bg-[var(--mc-border)]" />

          {/* Операции с проектом */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCreateProject}
              className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
              title="Создать новый проект"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Создать</span>
            </button>

            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
              title="Открыть список проектов"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Открыть</span>
            </Link>

            <button
              type="button"
              onClick={() => void saveCurrentProject()}
              disabled={saveStatus === "saving"}
              className={`inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors disabled:opacity-60 ${
                saveStatus === "unsaved"
                  ? "bg-[var(--mc-brand-soft)] text-[var(--mc-brand-inline)] hover:bg-[var(--mc-brand)] hover:text-[var(--mc-brand-text)]"
                  : saveStatus === "error"
                    ? "bg-rose-600/20 text-[var(--mc-danger-text)] hover:bg-rose-600/30"
                    : "text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
              }`}
              title="Сохранить проект в SQLite"
            >
              <Save className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">
                {saveStatus === "saving" ? "Сохранение..." : "Сохранить"}
              </span>
            </button>
          </div>
        </div>

        {/* Центральная группа: Отмена / Повтор и 2D / 3D */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded border border-[var(--mc-border)] bg-[var(--mc-bg-app)] p-0.5">
            <button
              type="button"
              onClick={undo}
              disabled={historyPastCount === 0}
              className="rounded p-1 text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-hover)] disabled:opacity-35 disabled:hover:bg-transparent"
              title="Отменить (Undo)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={historyFutureCount === 0}
              className="rounded p-1 text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-hover)] disabled:opacity-35 disabled:hover:bg-transparent"
              title="Повторить (Redo)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div
            className="flex items-center rounded border border-[var(--mc-border)] bg-[var(--mc-bg-app)] p-0.5"
            role="group"
            aria-label="Режим отображения"
          >
            <button
              type="button"
              onClick={() => setViewMode("2d")}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === "2d"
                  ? "bg-[var(--mc-brand)] text-[var(--mc-brand-text)] shadow-xs"
                  : "text-[var(--mc-text-muted)] hover:text-[var(--mc-text)]"
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
                  ? "bg-[var(--mc-brand)] text-[var(--mc-brand-text)] shadow-xs"
                  : "text-[var(--mc-text-muted)] hover:text-[var(--mc-text)]"
              }`}
            >
              <Box className="h-3.5 w-3.5" />
              3D
            </button>
          </div>
        </div>

        {/* Правая группа: Тема, Настройки и Экспорт / Смета */}
        <div className="flex items-center gap-1.5">
          <div
            className="flex items-center rounded border border-[var(--mc-border)] bg-[var(--mc-bg-app)] p-0.5"
            role="group"
            aria-label="Переключатель темы"
          >
            <button
              type="button"
              onClick={() => setTheme("light")}
              aria-pressed={theme === "light"}
              title="Светлая тема"
              className={`rounded p-1 transition-colors ${
                theme === "light"
                  ? "bg-[var(--mc-brand)] text-[var(--mc-brand-text)] shadow-xs"
                  : "text-[var(--mc-text-muted)] hover:text-[var(--mc-text)]"
              }`}
            >
              <Sun className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              aria-pressed={theme === "dark"}
              title="Тёмная тема"
              className={`rounded p-1 transition-colors ${
                theme === "dark"
                  ? "bg-[var(--mc-brand)] text-[var(--mc-brand-text)] shadow-xs"
                  : "text-[var(--mc-text-muted)] hover:text-[var(--mc-text)]"
              }`}
            >
              <Moon className="h-3.5 w-3.5" />
            </button>
          </div>

          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
            title="Настройки расчётов и сетки"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Настройки</span>
          </Link>

          <AccountHeaderBadge />

          <button
            type="button"
            onClick={() => void handleQuickExport("excel")}
            disabled={exportingFormat !== null}
            className="hidden items-center gap-1 rounded border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-2 py-1.5 text-xs text-[var(--mc-success-text)] hover:bg-[var(--mc-bg-hover)] disabled:opacity-60 xl:inline-flex"
            title="Скачать смету в Excel (.xlsx)"
          >
            {exportingFormat === "excel" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5" />
            )}
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={() => void handleQuickExport("pdf")}
            disabled={exportingFormat !== null}
            className="hidden items-center gap-1 rounded border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-2 py-1.5 text-xs text-[var(--mc-brand-inline)] hover:bg-[var(--mc-bg-hover)] disabled:opacity-60 xl:inline-flex"
            title="Скачать чертёж и смету в PDF"
          >
            {exportingFormat === "pdf" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setEstimateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded bg-[var(--mc-brand)] px-2.5 py-1.5 text-xs font-medium text-[var(--mc-brand-text)] hover:bg-[var(--mc-brand-light)] transition-colors shadow-xs"
            title="Открыть смету и экспорт"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Экспорт / Смета</span>
          </button>
        </div>
      </header>

      <EstimateModal open={estimateOpen} onClose={() => setEstimateOpen(false)} />
    </>
  );
}
