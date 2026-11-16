"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Database,
  FilePlus2,
  FolderOpen,
  Layers,
  Loader2,
  Moon,
  Pencil,
  Ruler,
  Search,
  Sparkles,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { AccountHeaderBadge } from "@/components/auth/AccountHeaderBadge";
import { formatMoney } from "@/lib/calculations/estimate";
import { useProjectStore } from "@/store/useProjectStore";
import { useThemeStore } from "@/store/useThemeStore";
import type { CurrencyCode } from "@/types";

export function ProjectsClient() {
  const router = useRouter();
  const currentProject = useProjectStore((s) => s.project);
  const savedProjects = useProjectStore((s) => s.savedProjects);
  const projectsLoading = useProjectStore((s) => s.projectsLoading);
  const lastError = useProjectStore((s) => s.lastError);

  const hydrateFromStorage = useProjectStore((s) => s.hydrateFromStorage);
  const fetchSavedProjects = useProjectStore((s) => s.fetchSavedProjects);
  const openProjectById = useProjectStore((s) => s.openProjectById);
  const createNewProject = useProjectStore((s) => s.createNewProject);
  const loadExampleProject = useProjectStore((s) => s.loadExampleProject);
  const duplicateCurrentProject = useProjectStore((s) => s.duplicateCurrentProject);
  const duplicateSavedProject = useProjectStore((s) => s.duplicateSavedProject);
  const renameSavedProject = useProjectStore((s) => s.renameSavedProject);
  const deleteSavedProject = useProjectStore((s) => s.deleteSavedProject);
  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);

  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const [newName, setNewName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    void hydrateFromStorage();
    void fetchSavedProjects();
  }, [hydrateFromStorage, fetchSavedProjects]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return savedProjects;
    return savedProjects.filter((item) => item.name.toLowerCase().includes(q));
  }, [savedProjects, searchQuery]);

  const handleOpen = async (id: string) => {
    const ok = await openProjectById(id);
    if (ok) {
      router.push("/editor");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    createNewProject(newName.trim() || "Новый проект");
    const saved = await saveCurrentProject();
    if (saved) {
      setNewName("");
      router.push("/editor");
    }
  };

  const handleLoadExample = async () => {
    loadExampleProject();
    const saved = await saveCurrentProject();
    if (saved) {
      router.push("/editor");
    }
  };

  const handleDuplicateCurrent = async () => {
    await duplicateCurrentProject();
  };

  const handleDuplicateItem = async (id: string) => {
    await duplicateSavedProject(id);
  };

  const startRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingName("");
  };

  const commitRename = async (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    const ok = await renameSavedProject(id, trimmed);
    if (ok) {
      setEditingId(null);
      setEditingName("");
    }
  };

  const handleDelete = async (id: string) => {
    await deleteSavedProject(id);
  };

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
              Проекты
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden items-center gap-1.5 rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-2.5 py-1 text-[11px] text-[var(--mc-text-muted)] md:inline-flex">
            <Database className="h-3.5 w-3.5 text-[var(--mc-success-text)]" />
            <span>SQLite · Личные проекты</span>
          </div>

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
              className={`rounded p-1.5 transition-colors ${
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
              className={`rounded p-1.5 transition-colors ${
                theme === "dark"
                  ? "bg-[var(--mc-brand)] text-[var(--mc-brand-text)] shadow-xs"
                  : "text-[var(--mc-text-muted)] hover:text-[var(--mc-text)]"
              }`}
            >
              <Moon className="h-3.5 w-3.5" />
            </button>
          </div>

          <AccountHeaderBadge />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        {lastError && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-[var(--mc-danger-border)] bg-[var(--mc-danger-soft)] px-4 py-3 text-xs text-[var(--mc-danger-text)]"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{lastError}</span>
          </div>
        )}

        {/* Панель создания и шаблонов */}
        <section className="rounded-xl border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--mc-text)]">
                Новый проект или дубликат
              </h2>
              <p className="mt-0.5 text-xs text-[var(--mc-text-muted)]">
                Создайте пустой чертёж, скопируйте текущую сцену или начните с готового примера
                навеса.
              </p>
            </div>
          </div>

          <form onSubmit={(e) => void handleCreate(e)} className="mt-4 flex flex-wrap gap-2.5">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Название нового проекта (например, Навес 6×4)"
              className="min-w-60 flex-1 rounded-lg border border-[var(--mc-border-strong)] bg-[var(--mc-bg-input)] px-3.5 py-2 text-xs text-[var(--mc-text)] placeholder-[var(--mc-text-subtle)] outline-none transition-colors focus:border-[var(--mc-brand-light)]"
            />
            <button
              type="submit"
              disabled={projectsLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--mc-brand)] px-4 py-2 text-xs font-semibold text-[var(--mc-brand-text)] transition-colors hover:bg-[var(--mc-brand-light)] disabled:opacity-60"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              <span>Создать пустой проект</span>
            </button>
            <button
              type="button"
              onClick={() => void handleDuplicateCurrent()}
              disabled={projectsLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--mc-border-strong)] bg-[var(--mc-bg-elevated)] px-3.5 py-2 text-xs font-medium text-[var(--mc-text)] transition-colors hover:bg-[var(--mc-bg-hover)] disabled:opacity-60"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Копия текущего</span>
            </button>
            <button
              type="button"
              onClick={() => void handleLoadExample()}
              disabled={projectsLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] px-3.5 py-2 text-xs font-medium text-[var(--mc-brand-inline)] transition-colors hover:bg-[var(--mc-brand)] hover:text-[var(--mc-brand-text)] disabled:opacity-60"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Создать из примера</span>
            </button>
          </form>
        </section>

        {/* Список сохранённых проектов */}
        <section className="overflow-hidden rounded-xl border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--mc-border)] px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--mc-text-muted)]">
                Мои сохранённые проекты
              </h2>
              <span className="rounded-full border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-2 py-0.5 font-mono text-[11px] font-medium text-[var(--mc-text)]">
                {savedProjects.length}
              </span>
              {projectsLoading && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--mc-brand-inline)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Обновление...
                </span>
              )}
            </div>

            {savedProjects.length > 0 && (
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--mc-text-subtle)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Фильтр по названию..."
                  className="w-full rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-input)] py-1.5 pl-8 pr-3 text-xs text-[var(--mc-text)] placeholder-[var(--mc-text-subtle)] outline-none transition-colors focus:border-[var(--mc-brand-light)]"
                />
              </div>
            )}
          </div>

          {savedProjects.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-xs text-[var(--mc-text-muted)]">
                {projectsLoading
                  ? "Загрузка проектов из SQLite..."
                  : "Сохранённых проектов пока нет. Нажмите «Сохранить» в редакторе или создайте проект выше."}
              </p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--mc-text-muted)]">
              По запросу «{searchQuery}» проекты не найдены.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--mc-border)]">
              {filteredProjects.map((item) => {
                const isCurrent = item.id === currentProject.id;
                const isEditing = editingId === item.id;

                return (
                  <li
                    key={item.id}
                    className={`flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[var(--mc-bg-elevated)]/70 ${
                      isCurrent ? "bg-[var(--mc-brand-soft)]/35" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void commitRename(item.id);
                              if (e.key === "Escape") cancelRename();
                            }}
                            autoFocus
                            className="w-64 rounded-md border border-[var(--mc-brand-light)] bg-[var(--mc-bg-input)] px-2.5 py-1.5 text-xs text-[var(--mc-text)] outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => void commitRename(item.id)}
                            className="rounded-md bg-[var(--mc-brand)] p-1.5 text-[var(--mc-brand-text)] hover:bg-[var(--mc-brand-light)]"
                            title="Сохранить название"
                            aria-label="Сохранить название"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelRename}
                            className="rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] p-1.5 text-[var(--mc-text-muted)] hover:text-[var(--mc-text)]"
                            title="Отмена"
                            aria-label="Отменить переименование"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[var(--mc-text)]">
                            {item.name}
                          </span>
                          {item.isExample && (
                            <span className="rounded border border-[var(--mc-warning-border)] bg-[var(--mc-warning-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--mc-warning-text)]">
                              Пример
                            </span>
                          )}
                          {isCurrent && (
                            <span className="rounded border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--mc-brand-inline)]">
                              Активный в редакторе
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--mc-text-muted)]">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Layers className="h-3 w-3 text-[var(--mc-text-subtle)]" />
                          Элементов: <strong className="font-mono text-[var(--mc-text)]">{item.elementCount}</strong>
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Ruler className="h-3 w-3 text-[var(--mc-text-subtle)]" />
                          Длина:{" "}
                          <strong className="font-mono text-[var(--mc-text)]">
                            {(item.totalLengthMm / 1000).toFixed(2)} м
                          </strong>
                        </span>
                        <span className="font-mono font-semibold tabular-nums text-[var(--mc-brand-inline)]">
                          {formatMoney(item.totalCost, (item.currency as CurrencyCode) || "RUB")}
                        </span>
                        <span className="text-[var(--mc-text-subtle)]">
                          Обновлён: {new Date(item.updatedAt).toLocaleString("ru-RU")}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleOpen(item.id)}
                        disabled={projectsLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--mc-border-strong)] bg-[var(--mc-bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--mc-text)] transition-colors hover:bg-[var(--mc-bg-hover)] disabled:opacity-60"
                      >
                        <FolderOpen className="h-3.5 w-3.5 text-[var(--mc-brand-inline)]" />
                        <span>Открыть</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => startRename(item.id, item.name)}
                        disabled={projectsLoading}
                        className="rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] p-2 text-[var(--mc-text-secondary)] transition-colors hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)] disabled:opacity-60"
                        title="Переименовать проект"
                        aria-label="Переименовать проект"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDuplicateItem(item.id)}
                        disabled={projectsLoading}
                        className="rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] p-2 text-[var(--mc-text-secondary)] transition-colors hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)] disabled:opacity-60"
                        title="Дублировать проект"
                        aria-label="Дублировать проект"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(item.id)}
                        disabled={projectsLoading}
                        className="rounded-lg border border-[var(--mc-danger-border)] bg-[var(--mc-danger-soft)] p-2 text-[var(--mc-danger-text)] transition-colors hover:opacity-85 disabled:opacity-60"
                        title="Удалить проект"
                        aria-label="Удалить проект"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
