"use client";

import { useState } from "react";
import {
  Copy,
  Layers,
  Minus,
  MousePointer2,
  Move,
  Pencil,
  PencilLine,
  Plus,
  Ruler,
  Search,
  SlidersHorizontal,
  Spline,
  Square,
  Trash2,
} from "lucide-react";
import { ProfileCatalogModal } from "@/features/profiles/ProfileCatalogModal";
import {
  calculateProjectEstimate,
  formatMoney,
  formatProfileDimensions,
} from "@/lib/calculations/estimate";
import { useProjectStore } from "@/store/useProjectStore";
import type { DrawingTool } from "@/types";

const TOOLS: { id: DrawingTool; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "select", label: "Выбор", icon: MousePointer2 },
  { id: "line", label: "Линия", icon: Minus },
  { id: "rectangle", label: "Прямоуг.", icon: Square },
  { id: "polyline", label: "Ломаная", icon: Spline },
  { id: "move", label: "Сдвиг", icon: Move },
  { id: "copy", label: "Копия", icon: Copy },
  { id: "resize", label: "Размер", icon: Ruler },
  { id: "delete", label: "Удалить", icon: Trash2 },
];

type SidebarShapeFilter = "all" | "rectangular_tube" | "square_tube";

export function LeftSidebar() {
  const project = useProjectStore((s) => s.project);
  const activeTool = useProjectStore((s) => s.activeTool);
  const activeProfileId = useProjectStore((s) => s.activeProfileId);
  const selectedElementIds = useProjectStore((s) => s.selectedElementIds);

  const setActiveTool = useProjectStore((s) => s.setActiveTool);
  const setActiveProfileId = useProjectStore((s) => s.setActiveProfileId);
  const assignProfileToElements = useProjectStore((s) => s.assignProfileToElements);
  const addElement = useProjectStore((s) => s.addElement);

  const [searchQuery, setSearchQuery] = useState("");
  const [shapeFilter, setShapeFilter] = useState<SidebarShapeFilter>("all");
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [editProfileId, setEditProfileId] = useState<string | null>(null);

  // Поля быстрого добавления балки по координатам (мм)
  const [x1, setX1] = useState("0");
  const [y1, setY1] = useState("0");
  const [z1, setZ1] = useState("0");
  const [x2, setX2] = useState("1000");
  const [y2, setY2] = useState("0");
  const [z2, setZ2] = useState("0");
  const [beamError, setBeamError] = useState<string | null>(null);

  const estimate = calculateProjectEstimate(
    project.elements,
    project.profiles,
    project.joints,
    project.calculationSettings
  );

  const filteredProfiles = project.profiles.filter((p) => {
    if (shapeFilter !== "all" && p.shapeType !== shapeFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      `${p.widthMm}x${p.heightMm}`.includes(q) ||
      `${p.widthMm}×${p.heightMm}`.includes(q)
    );
  });

  const handleAddBeam = (e: React.FormEvent) => {
    e.preventDefault();
    const sx = Number(x1);
    const sy = Number(y1);
    const sz = Number(z1);
    const ex = Number(x2);
    const ey = Number(y2);
    const ez = Number(z2);

    if (![sx, sy, sz, ex, ey, ez].every(Number.isFinite)) {
      setBeamError("Введите корректные числа в миллиметрах.");
      return;
    }
    if (Math.hypot(ex - sx, ey - sy, ez - sz) < 1) {
      setBeamError("Длина элемента должна быть не менее 1 мм.");
      return;
    }

    setBeamError(null);
    addElement({ x: sx, y: sy, z: sz }, { x: ex, y: ey, z: ez }, activeProfileId);
  };

  const openCatalogForNew = () => {
    setEditProfileId(null);
    setCatalogModalOpen(true);
  };

  const openCatalogForEdit = (profileId: string) => {
    setEditProfileId(profileId);
    setCatalogModalOpen(true);
  };

  return (
    <>
      <aside className="flex w-72 shrink-0 flex-col border-r border-[var(--mc-border)] bg-[var(--mc-bg-panel)] overflow-y-auto">
        {/* Секция 1: Инструменты черчения */}
        <section className="border-b border-[var(--mc-border)] p-3">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--mc-text-muted)]">
            Инструменты черчения
          </h2>
          <div className="grid grid-cols-4 gap-1.5">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setActiveTool(tool.id)}
                  className={`flex flex-col items-center justify-center gap-1 rounded border px-1 py-2 text-[10px] transition-colors ${
                    isActive
                      ? "border-[var(--mc-brand-light)] bg-[var(--mc-brand)] text-[var(--mc-brand-text)] shadow-xs"
                      : "border-[var(--mc-border)] bg-[var(--mc-bg-app)] text-[var(--mc-text-muted)] hover:border-[var(--mc-border-strong)] hover:text-[var(--mc-text)]"
                  }`}
                  title={tool.label}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="truncate max-w-full">{tool.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Секция 2: Каталог профильных труб */}
        <section className="border-b border-[var(--mc-border)] p-3">
          <div className="mb-2 flex items-center justify-between gap-1">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mc-text-muted)]">
              Каталог профилей
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={openCatalogForNew}
                className="inline-flex items-center gap-1 rounded bg-[var(--mc-bg-elevated)] px-2 py-0.5 text-[11px] text-[var(--mc-text)] hover:bg-[var(--mc-bg-hover)]"
                title="Открыть расширенный каталог и управление профилями"
              >
                <SlidersHorizontal className="h-3 w-3" />
                Каталог
              </button>
              <button
                type="button"
                onClick={openCatalogForNew}
                className="inline-flex items-center rounded bg-[var(--mc-brand-soft)] px-1.5 py-0.5 text-[11px] text-[var(--mc-brand-inline)] hover:bg-[var(--mc-brand)] hover:text-[var(--mc-brand-text)]"
                title="Создать новый профиль"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--mc-text-subtle)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по размеру..."
              className="w-full rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] py-1.5 pl-7 pr-2 text-xs text-[var(--mc-text)] placeholder-[var(--mc-text-subtle)] outline-none focus:border-[var(--mc-brand-light)]"
            />
          </div>

          {/* Быстрый фильтр по форме трубы */}
          <div className="mb-2 grid grid-cols-3 gap-1">
            {(
              [
                { id: "all", label: "Все" },
                { id: "rectangular_tube", label: "Прямоуг." },
                { id: "square_tube", label: "Квадрат." },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setShapeFilter(f.id)}
                className={`rounded border py-1 text-[10px] transition-colors ${
                  shapeFilter === f.id
                    ? "border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] font-medium text-[var(--mc-brand-inline)]"
                    : "border-[var(--mc-border)] bg-[var(--mc-bg-app)] text-[var(--mc-text-muted)] hover:text-[var(--mc-text)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
            {filteredProfiles.length === 0 ? (
              <div className="py-3 text-center text-[11px] text-[var(--mc-text-subtle)]">
                Профили не найдены
              </div>
            ) : (
              filteredProfiles.map((profile) => {
                const isSelected = activeProfileId === profile.id;
                return (
                  <div
                    key={profile.id}
                    className={`group flex items-center justify-between rounded border px-2 py-1.5 transition-colors ${
                      isSelected
                        ? "border-[var(--mc-brand-light)] bg-[var(--mc-brand-soft)]"
                        : "border-[var(--mc-border)] bg-[var(--mc-bg-app)] hover:border-[var(--mc-border-strong)]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveProfileId(profile.id)}
                      className="flex flex-1 items-center gap-2 min-w-0 text-left"
                    >
                      <span
                        className="h-3.5 w-1.5 shrink-0 rounded-xs"
                        style={{ backgroundColor: profile.color }}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-[var(--mc-text)]">
                          {profile.name}
                        </div>
                        <div className="text-[10px] text-[var(--mc-text-muted)]">
                          {formatProfileDimensions(profile)}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0 pl-1">
                      <div className="text-right">
                        <div className="text-xs font-medium tabular-nums text-[var(--mc-text)]">
                          {formatMoney(profile.pricePerMeter, project.calculationSettings.currency)}/м
                        </div>
                        {profile.isExample && (
                          <div className="text-[9px] text-[var(--mc-warning-text)] opacity-85">пример</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openCatalogForEdit(profile.id)}
                        className="rounded p-1 text-[var(--mc-text-subtle)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
                        title="Редактировать профиль"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {selectedElementIds.length > 0 && activeProfileId && (
            <button
              type="button"
              onClick={() => assignProfileToElements(selectedElementIds, activeProfileId)}
              className="mt-2 w-full rounded border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] py-1.5 text-[11px] font-medium text-[var(--mc-brand-inline)] hover:bg-[var(--mc-brand)] hover:text-[var(--mc-brand-text)]"
            >
              Назначить активный профиль выбранным ({selectedElementIds.length})
            </button>
          )}
        </section>

        {/* Секция 3: Быстрое построение элемента по координатам */}
        <section className="border-b border-[var(--mc-border)] p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <PencilLine className="h-3.5 w-3.5 text-[var(--mc-brand-light)]" />
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mc-text-muted)]">
              Добавить элемент (мм)
            </h2>
          </div>
          <form onSubmit={handleAddBeam} className="space-y-2">
            <div className="grid grid-cols-3 gap-1.5">
              <label className="text-[10px] text-[var(--mc-text-muted)]">
                Нач. X
                <input
                  type="number"
                  value={x1}
                  onChange={(e) => setX1(e.target.value)}
                  className="mt-0.5 w-full rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-1.5 py-1 text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-light)]"
                />
              </label>
              <label className="text-[10px] text-[var(--mc-text-muted)]">
                Нач. Y
                <input
                  type="number"
                  value={y1}
                  onChange={(e) => setY1(e.target.value)}
                  className="mt-0.5 w-full rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-1.5 py-1 text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-light)]"
                />
              </label>
              <label className="text-[10px] text-[var(--mc-text-muted)]">
                Нач. Z
                <input
                  type="number"
                  value={z1}
                  onChange={(e) => setZ1(e.target.value)}
                  className="mt-0.5 w-full rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-1.5 py-1 text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-light)]"
                />
              </label>
              <label className="text-[10px] text-[var(--mc-text-muted)]">
                Кон. X
                <input
                  type="number"
                  value={x2}
                  onChange={(e) => setX2(e.target.value)}
                  className="mt-0.5 w-full rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-1.5 py-1 text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-light)]"
                />
              </label>
              <label className="text-[10px] text-[var(--mc-text-muted)]">
                Кон. Y
                <input
                  type="number"
                  value={y2}
                  onChange={(e) => setY2(e.target.value)}
                  className="mt-0.5 w-full rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-1.5 py-1 text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-light)]"
                />
              </label>
              <label className="text-[10px] text-[var(--mc-text-muted)]">
                Кон. Z
                <input
                  type="number"
                  value={z2}
                  onChange={(e) => setZ2(e.target.value)}
                  className="mt-0.5 w-full rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-1.5 py-1 text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-light)]"
                />
              </label>
            </div>
            {beamError && <div className="text-[11px] text-[var(--mc-danger-text)]">{beamError}</div>}
            <button
              type="submit"
              className="w-full rounded border border-[var(--mc-brand-border)] bg-[var(--mc-bg-elevated)] py-1.5 text-xs font-medium text-[var(--mc-text)] hover:bg-[var(--mc-brand)] hover:text-[var(--mc-brand-text)] transition-colors"
            >
              + Построить по координатам
            </button>
          </form>
        </section>

        {/* Секция 4: Используемые материалы в проекте */}
        <section className="p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-[var(--mc-text-muted)]" />
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mc-text-muted)]">
              Используемые материалы
            </h2>
          </div>

          {estimate.profileItems.length === 0 ? (
            <p className="text-xs text-[var(--mc-text-subtle)]">Нет элементов в конструкции.</p>
          ) : (
            <ul className="space-y-1.5">
              {estimate.profileItems.map((item) => (
                <li
                  key={item.profileId}
                  className="flex items-center justify-between rounded border border-[var(--mc-border)] bg-[var(--mc-bg-app)] px-2 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-xs"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate text-[var(--mc-text)]">{item.profileName}</span>
                  </div>
                  <span className="shrink-0 tabular-nums text-[var(--mc-text-muted)]">
                    {item.totalLengthMeters.toFixed(2)} м
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>

      <ProfileCatalogModal
        open={catalogModalOpen}
        initialEditProfileId={editProfileId}
        onClose={() => setCatalogModalOpen(false)}
      />
    </>
  );
}
