"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Copy, FilePlus2, FolderOpen, Sparkles, Trash2 } from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";

const emptySubscribe = () => () => {};

export default function ProjectsPage() {
  const router = useRouter();
  const currentProject = useProjectStore((s) => s.project);
  const hydrateFromStorage = useProjectStore((s) => s.hydrateFromStorage);
  const getSavedProjectSummaries = useProjectStore((s) => s.getSavedProjectSummaries);
  const openProjectById = useProjectStore((s) => s.openProjectById);
  const createNewProject = useProjectStore((s) => s.createNewProject);
  const loadExampleProject = useProjectStore((s) => s.loadExampleProject);
  const duplicateCurrentProject = useProjectStore((s) => s.duplicateCurrentProject);
  const deleteSavedProject = useProjectStore((s) => s.deleteSavedProject);
  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);

  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [revision, setRevision] = useState(0);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  // Читаем актуальный список сохранённых проектов на клиенте при изменении текущего проекта или revision
  const projects = isClient ? getSavedProjectSummaries() : [];
  void revision;

  const refreshList = () => setRevision((v) => v + 1);

  const handleOpen = (id: string) => {
    if (openProjectById(id)) {
      router.push("/");
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createNewProject(newName.trim() || "Новый проект");
    saveCurrentProject();
    setNewName("");
    refreshList();
    router.push("/");
  };

  const handleLoadExample = () => {
    loadExampleProject();
    saveCurrentProject();
    refreshList();
    router.push("/");
  };

  const handleDuplicate = () => {
    duplicateCurrentProject();
    refreshList();
  };

  const handleDelete = (id: string) => {
    deleteSavedProject(id);
    refreshList();
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
        <div className="text-xs text-[#9aa2b1]">
          Локальное хранилище (Supabase будет подключён на этапе 6)
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6 space-y-6">
        <section className="rounded-lg border border-[#2c313a] bg-[#181b20] p-4">
          <h1 className="text-sm font-semibold text-white">Создать или скопировать проект</h1>
          <form onSubmit={handleCreate} className="mt-3 flex flex-wrap gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Название нового проекта (например, Навес 6×4)"
              className="flex-1 min-w-60 rounded border border-[#2c313a] bg-[#121417] px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              Создать пустой проект
            </button>
            <button
              type="button"
              onClick={handleDuplicate}
              className="inline-flex items-center gap-1.5 rounded border border-[#343a46] bg-[#22262d] px-3 py-1.5 text-xs text-[#e6e8ec] hover:bg-[#2c313a]"
            >
              <Copy className="h-3.5 w-3.5" />
              Копия текущего
            </button>
            <button
              type="button"
              onClick={handleLoadExample}
              className="inline-flex items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-500/20"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Открыть пример
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-[#2c313a] bg-[#181b20] overflow-hidden">
          <div className="border-b border-[#2c313a] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#9aa2b1]">
            Сохранённые проекты ({projects.length})
          </div>

          {projects.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#6c7484]">
              Сохранённых проектов пока нет. Нажмите «Сохранить» в редакторе или создайте проект выше.
            </div>
          ) : (
            <ul className="divide-y divide-[#252932]">
              {projects.map((item) => {
                const isCurrent = item.id === currentProject.id;
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[#1e2229]"
                  >
                    <div className="min-w-0">
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
                      <div className="mt-0.5 text-[11px] text-[#9aa2b1]">
                        Элементов: {item.elementCount} · Обновлён:{" "}
                        {new Date(item.updatedAt).toLocaleString("ru-RU")}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpen(item.id)}
                        className="inline-flex items-center gap-1.5 rounded border border-[#343a46] bg-[#22262d] px-2.5 py-1.5 text-xs text-white hover:bg-[#2c313a]"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        Открыть
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20"
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
