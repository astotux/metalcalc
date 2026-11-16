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
  PanelLeft,
  PanelRight,
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
import { useWorkspaceUiStore } from "@/store/useWorkspaceUiStore";

export function TopToolbar() {
  const project = useProjectStore((s) => s.project);
  const saveStatus = useProjectStore((s) => s.saveStatus);
  const selectedElementIds = useProjectStore((s) => s.selectedElementIds);
  const selectedJointId = useProjectStore((s) => s.selectedJointId);
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

  const leftPanelOpen = useWorkspaceUiStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useWorkspaceUiStore((s) => s.rightPanelOpen);
  const leftDrawerOpen = useWorkspaceUiStore((s) => s.leftDrawerOpen);
  const rightDrawerOpen = useWorkspaceUiStore((s) => s.rightDrawerOpen);
  const toggleLeftPanel = useWorkspaceUiStore((s) => s.toggleLeftPanel);
  const toggleRightPanel = useWorkspaceUiStore((s) => s.toggleRightPanel);
  const toggleLeftDrawer = useWorkspaceUiStore((s) => s.toggleLeftDrawer);
  const toggleRightDrawer = useWorkspaceUiStore((s) => s.toggleRightDrawer);

  const hasSelection = selectedElementIds.length > 0 || selectedJointId !== null;

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
    createNewProject(
      `Проект от ${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`
    );
  };

  return (
    <>
      <header className="flex h-12 shrink-0 items-center justify-between gap-1.5 border-b border-[var(--mc-border)] bg-[var(--mc-bg-panel)] px-2 lg:px-3">
        {/* Левая группа: панель инструментов, логотип, название и файловые операции */}
        <div className="flex min-w-0 items-center gap-1.5 lg:gap-2">
          <button
            type="button"
            onClick={toggleLeftDrawer}
            aria-pressed={leftDrawerOpen}
            title="Инструменты и профили"
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors lg:hidden ${
              leftDrawerOpen
                ? "border-[var(--mc-brand-light)] bg-[var(--mc-brand)] text-[var(--mc-brand-text)]"
                : "border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
            }`}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggleLeftPanel}
            aria-pressed={leftPanelOpen}
            title={leftPanelOpen ? "Свернуть левую панель" : "Показать левую панель"}
            className={`hidden h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors lg:inline-flex ${
              leftPanelOpen
                ? "border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] text-[var(--mc-brand-inline)]"
                : "border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] text-[var(--mc-text-muted)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
            }`}
          >
            <PanelLeft className="h-3.5 w-3.5" />
          </button>

          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-[var(--mc-bg-hover)] lg:px-1.5"
            title="MetalCalc — На главную"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--mc-brand)] font-mono text-[11px] font-bold text-[var(--mc-brand-text)] shadow-xs">
              MC
            </div>
            <span className="hidden text-sm font-semibold tracking-tight text-[var(--mc-text)] xl:inline">
              MetalCalc
            </span>
          </Link>

          <div className="h-5 w-px shrink-0 bg-[var(--mc-border)]" />

          {/* Название проекта */}
          <div className="flex min-w-0 items-center gap-1.5">
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
                className="w-32 rounded-md border border-[var(--mc-brand-light)] bg-[var(--mc-bg-input)] px-2 py-0.5 text-xs text-[var(--mc-text)] outline-none sm:w-40 lg:w-48"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTitleDraft(project.name);
                  setIsEditingTitle(true);
                }}
                className="max-w-[96px] truncate rounded-md px-2 py-1 text-xs font-medium text-[var(--mc-text)] transition-colors hover:bg-[var(--mc-bg-hover)] sm:max-w-[140px] lg:max-w-[180px] xl:max-w-[200px]"
                title="Нажмите, чтобы переименовать проект"
              >
                {project.name}
              </button>
            )}

            {project.isExample && (
              <span className="hidden rounded border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--mc-brand-inline)] xl:inline">
                Пример
              </span>
            )}
          </div>

          <div className="h-5 w-px shrink-0 bg-[var(--mc-border)]" />

          {/* Операции с проектом */}
          <div className="flex shrink-0 items-center gap-0.5 lg:gap-1">
            <button
              type="button"
              onClick={handleCreateProject}
              className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-xs text-[var(--mc-text-secondary)] transition-colors hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)] lg:px-2"
              title="Создать новый проект"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Создать</span>
            </button>

            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-xs text-[var(--mc-text-secondary)] transition-colors hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)] lg:px-2"
              title="Открыть список проектов"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Открыть</span>
            </Link>

            <button
              type="button"
              onClick={() => void saveCurrentProject()}
              disabled={saveStatus === "saving"}
              className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 lg:px-2.5 ${
                saveStatus === "unsaved"
                  ? "border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] text-[var(--mc-brand-inline)] hover:bg-[var(--mc-brand)] hover:text-[var(--mc-brand-text)]"
                  : saveStatus === "error"
                    ? "border border-[var(--mc-danger-border)] bg-[var(--mc-danger-soft)] text-[var(--mc-danger-text)]"
                    : "text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
              }`}
              title="Сохранить проект в SQLite"
            >
              <Save className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">
                {saveStatus === "saving" ? "Сохранение..." : "Сохранить"}
              </span>
            </button>
          </div>
        </div>

        {/* Центральная группа: Отмена / Повтор и 2D / 3D */}
        <div className="flex shrink-0 items-center gap-1.5 lg:gap-2">
          <div className="flex items-center rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-app)] p-0.5">
            <button
              type="button"
              onClick={undo}
              disabled={historyPastCount === 0}
              className="rounded p-1.5 text-[var(--mc-text-secondary)] transition-colors hover:bg-[var(--mc-bg-hover)] disabled:opacity-35 disabled:hover:bg-transparent lg:p-1"
              title="Отменить (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={historyFutureCount === 0}
              className="rounded p-1.5 text-[var(--mc-text-secondary)] transition-colors hover:bg-[var(--mc-bg-hover)] disabled:opacity-35 disabled:hover:bg-transparent lg:p-1"
              title="Повторить (Ctrl+Y)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div
            className="flex items-center rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-app)] p-0.5"
            role="group"
            aria-label="Режим отображения"
          >
            <button
              type="button"
              onClick={() => setViewMode("2d")}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold transition-colors lg:px-2.5 ${
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
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold transition-colors lg:px-2.5 ${
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

        {/* Правая группа: Тема, Настройки, Аккаунт, Экспорт / Смета и правая панель */}
        <div className="flex shrink-0 items-center gap-1 lg:gap-1.5">
          <div
            className="flex items-center rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-app)] p-0.5"
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
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-xs text-[var(--mc-text-secondary)] transition-colors hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)] lg:px-2"
            title="Настройки расчётов и сетки"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Настройки</span>
          </Link>

          <AccountHeaderBadge />

          <button
            type="button"
            onClick={() => void handleQuickExport("excel")}
            disabled={exportingFormat !== null}
            className="hidden items-center gap-1 rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-2 py-1.5 text-xs font-medium text-[var(--mc-success-text)] transition-colors hover:bg-[var(--mc-bg-hover)] disabled:opacity-60 xl:inline-flex"
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
            className="hidden items-center gap-1 rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-2 py-1.5 text-xs font-medium text-[var(--mc-brand-inline)] transition-colors hover:bg-[var(--mc-bg-hover)] disabled:opacity-60 xl:inline-flex"
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
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--mc-brand)] px-2.5 py-1.5 text-xs font-semibold text-[var(--mc-brand-text)] shadow-xs transition-colors hover:bg-[var(--mc-brand-light)] lg:px-3"
            title="Открыть смету и экспорт"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline lg:hidden">Смета</span>
            <span className="hidden lg:inline">Экспорт / Смета</span>
          </button>

          <button
            type="button"
            onClick={toggleRightDrawer}
            aria-pressed={rightDrawerOpen}
            title="Свойства, стыки и смета"
            className={`relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors lg:hidden ${
              rightDrawerOpen
                ? "border-[var(--mc-brand-light)] bg-[var(--mc-brand)] text-[var(--mc-brand-text)]"
                : "border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
            }`}
          >
            <PanelRight className="h-4 w-4" />
            {hasSelection && !rightDrawerOpen && (
              <span
                className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[var(--mc-brand-light)] ring-2 ring-[var(--mc-bg-panel)]"
                aria-hidden="true"
              />
            )}
          </button>
          <button
            type="button"
            onClick={toggleRightPanel}
            aria-pressed={rightPanelOpen}
            title={rightPanelOpen ? "Свернуть правую панель" : "Показать правую панель"}
            className={`hidden h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors lg:inline-flex ${
              rightPanelOpen
                ? "border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] text-[var(--mc-brand-inline)]"
                : "border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] text-[var(--mc-text-muted)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
            }`}
          >
            <PanelRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <EstimateModal open={estimateOpen} onClose={() => setEstimateOpen(false)} />
    </>
  );
}
