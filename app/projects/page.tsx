"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Database,
  FilePlus2,
  FolderOpen,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { formatMoney } from "@/lib/calculations/estimate";
import { useProjectStore } from "@/store/useProjectStore";
import type { CurrencyCode } from "@/types";

export default function ProjectsPage() {
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

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    void hydrateFromStorage();
    void fetchSavedProjects();
  }, [hydrateFromStorage, fetchSavedProjects]);

  const handleOpen = async (id: string) => {
    const ok = await openProjectById(id);
    if (ok) {
      router.push("/");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    createNewProject(newName.trim() || "Новый проект");
    const saved = await saveCurrentProject();
    if (saved) {
      setNewName("");
      router.push("/");
    }
  };

  const handleLoadExample = async () => {
    loadExampleProject();
    const saved = await saveCurrentProject();
    if (saved) {
      router.push("/");
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
          <span className="text-sm font-semibold text-white">Проекты MetalCalc</span>
        </div>
        <div className="inline-flex items-center gap-1.5 text-xs text-[#9aa2b1]">
          <Database className="h-3.5 w-3.5 text-emerald-400" />
          <span>SQLite (data/metalcalc.db)</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6 space-y-6">
        {lastError && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{lastError}</span>
          </div>
        )}

        <section className="rounded-lg border border-[#2c313a] bg-[#181b20] p-4">
          <h1 className="text-sm font-semibold text-white">Создать или скопировать проект</h1>
          <form onSubmit={(e) => void handleCreate(e)} className="mt-3 flex flex-wrap gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Название нового проекта (например, Навес 6×4)"
              className="flex-1 min-w-60 rounded border border-[#2c313a] bg-[#121417] px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={projectsLoading}
              className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-60"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              Создать пустой проект
            </button>
            <button
              type="button"
              onClick={() => void handleDuplicateCurrent()}
              disabled={projectsLoading}
              className="inline-flex items-center gap-1.5 rounded border border-[#343a46] bg-[#22262d] px-3 py-1.5 text-xs text-[#e6e8ec] hover:bg-[#2c313a] disabled:opacity-60"
            >
              <Copy className="h-3.5 w-3.5" />
              Копия текущего
            </button>
            <button
              type="button"
              onClick={() => void handleLoadExample()}
              disabled={projectsLoading}
              className="inline-flex items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-500/20 disabled:opacity-60"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Открыть пример
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-[#2c313a] bg-[#181b20] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#2c313a] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#9aa2b1]">
            <span>Сохранённые проекты ({savedProjects.length})</span>
            {projectsLoading && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-normal normal-case text-blue-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Обновление...
              </span>
            )}
          </div>

          {savedProjects.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#6c7484]">
              {projectsLoading
                ? "Загрузка проектов из SQLite..."
                : "Сохранённых проектов пока нет. Нажмите «Сохранить» в редакторе или создайте проект выше."}
            </div>
          ) : (
            <ul className="divide-y divide-[#252932]">
              {savedProjects.map((item) => {
                const isCurrent = item.id === currentProject.id;
                const isEditing = editingId === item.id;

                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 hover:bg-[#1e2229]"
                  >
                    <div className="min-w-0 flex-1">
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
                            className="w-64 rounded border border-blue-500 bg-[#121417] px-2 py-1 text-xs text-white outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => void commitRename(item.id)}
                            className="rounded bg-blue-600 p-1 text-white hover:bg-blue-500"
                            title="Сохранить название"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelRename}
                            className="rounded border border-[#343a46] bg-[#22262d] p-1 text-[#9aa2b1] hover:text-white"
                            title="Отмена"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-white">
                            {item.name}
                          </span>
                          {item.isExample && (
                            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                              Пример
                            </span>
                          )}
                          {isCurrent && (
                            <span className="rounded bg-blue-600/20 px-1.5 py-0.5 text-[10px] text-blue-300">
                              Текущий
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#9aa2b1]">
                        <span>Элементов: {item.elementCount}</span>
                        <span>·</span>
                        <span>Длина: {(item.totalLengthMm / 1000).toFixed(2)} м</span>
                        <span>·</span>
                        <span className="text-blue-300">
                          {formatMoney(item.totalCost, (item.currency as CurrencyCode) || "RUB")}
                        </span>
                        <span>·</span>
                        <span>Обновлён: {new Date(item.updatedAt).toLocaleString("ru-RU")}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleOpen(item.id)}
                        disabled={projectsLoading}
                        className="inline-flex items-center gap-1.5 rounded border border-[#343a46] bg-[#22262d] px-2.5 py-1.5 text-xs text-white hover:bg-[#2c313a] disabled:opacity-60"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        Открыть
                      </button>
                      <button
                        type="button"
                        onClick={() => startRename(item.id, item.name)}
                        disabled={projectsLoading}
                        className="rounded border border-[#343a46] bg-[#22262d] p-1.5 text-[#c7cdd8] hover:bg-[#2c313a] hover:text-white disabled:opacity-60"
                        title="Переименовать проект"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDuplicateItem(item.id)}
                        disabled={projectsLoading}
                        className="rounded border border-[#343a46] bg-[#22262d] p-1.5 text-[#c7cdd8] hover:bg-[#2c313a] hover:text-white disabled:opacity-60"
                        title="Дублировать проект"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(item.id)}
                        disabled={projectsLoading}
                        className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20 disabled:opacity-60"
                        title="Удалить проект"
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
