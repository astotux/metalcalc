"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { PROFILE_SHAPE_CATALOG } from "@/features/profiles/defaults";
import { formatMoney, formatProfileDimensions } from "@/lib/calculations/estimate";
import { profileFormSchema, type ProfileFormValues } from "@/lib/validation/schemas";
import { useProjectStore } from "@/store/useProjectStore";
import type { MaterialProfile } from "@/types";

interface ProfileCatalogModalProps {
  open: boolean;
  initialEditProfileId?: string | null;
  onClose: () => void;
}

const COLOR_PRESETS = [
  "#38bdf8",
  "#34d399",
  "#f59e0b",
  "#a78bfa",
  "#fb7185",
  "#22d3ee",
  "#f97316",
  "#94a3b8",
];

type ShapeFilter = "all" | "rectangular_tube" | "square_tube";

export function ProfileCatalogModal({
  open,
  initialEditProfileId = null,
  onClose,
}: ProfileCatalogModalProps) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <ProfileCatalogDialogContent
      key={initialEditProfileId ?? "new"}
      initialEditProfileId={initialEditProfileId}
      onClose={onClose}
    />,
    document.body
  );
}

function ProfileCatalogDialogContent({
  initialEditProfileId,
  onClose,
}: {
  initialEditProfileId: string | null;
  onClose: () => void;
}) {
  const project = useProjectStore((s) => s.project);
  const activeProfileId = useProjectStore((s) => s.activeProfileId);
  const setActiveProfileId = useProjectStore((s) => s.setActiveProfileId);
  const addProfile = useProjectStore((s) => s.addProfile);
  const updateProfile = useProjectStore((s) => s.updateProfile);
  const deleteProfile = useProjectStore((s) => s.deleteProfile);
  const replaceProfileInProject = useProjectStore((s) => s.replaceProfileInProject);
  const saveCatalogAsDefault = useProjectStore((s) => s.saveCatalogAsDefault);

  const initialProfile = initialEditProfileId
    ? project.profiles.find((p) => p.id === initialEditProfileId) ?? null
    : null;

  const [searchQuery, setSearchQuery] = useState("");
  const [shapeFilter, setShapeFilter] = useState<ShapeFilter>("all");
  const [onlyUsed, setOnlyUsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(initialProfile?.id ?? null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<string>("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: initialProfile
      ? {
          name: initialProfile.name,
          shapeType:
            initialProfile.shapeType === "square_tube" ? "square_tube" : "rectangular_tube",
          widthMm: initialProfile.widthMm,
          heightMm: initialProfile.heightMm,
          wallThicknessMm: initialProfile.wallThicknessMm,
          pricePerMeter: initialProfile.pricePerMeter,
          color: initialProfile.color,
          description: initialProfile.description ?? "",
        }
      : {
          name: "",
          shapeType: "rectangular_tube",
          widthMm: 40,
          heightMm: 20,
          wallThicknessMm: 2,
          pricePerMeter: 350,
          color: "#38bdf8",
          description: "",
        },
  });

  const watchedShape = useWatch({ control, name: "shapeType" });
  const watchedWidth = useWatch({ control, name: "widthMm" }) || 40;
  const watchedHeight = useWatch({ control, name: "heightMm" }) || 20;
  const watchedWall = useWatch({ control, name: "wallThicknessMm" }) || 2;
  const watchedColor = useWatch({ control, name: "color" }) || "#38bdf8";

  // Счётчик использования каждого профиля в текущей конструкции
  const usageCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const el of project.elements) {
      map.set(el.profileId, (map.get(el.profileId) ?? 0) + 1);
    }
    return map;
  }, [project.elements]);

  const fillFormFromProfile = (profile: MaterialProfile) => {
    setEditingId(profile.id);
    setActionMessage(null);
    reset({
      name: profile.name,
      shapeType:
        profile.shapeType === "square_tube" ? "square_tube" : "rectangular_tube",
      widthMm: profile.widthMm,
      heightMm: profile.heightMm,
      wallThicknessMm: profile.wallThicknessMm,
      pricePerMeter: profile.pricePerMeter,
      color: profile.color,
      description: profile.description ?? "",
    });
  };

  const resetToNewMode = () => {
    setEditingId(null);
    setActionMessage(null);
    reset({
      name: "",
      shapeType: "rectangular_tube",
      widthMm: 40,
      heightMm: 20,
      wallThicknessMm: 2,
      pricePerMeter: 350,
      color: "#38bdf8",
      description: "",
    });
  };

  // При выборе квадратной трубы синхронизируем высоту с шириной
  useEffect(() => {
    if (watchedShape === "square_tube" && watchedHeight !== watchedWidth) {
      setValue("heightMm", watchedWidth, { shouldValidate: true });
    }
  }, [watchedShape, watchedWidth, watchedHeight, setValue]);

  const filteredProfiles = project.profiles.filter((p) => {
    if (shapeFilter !== "all" && p.shapeType !== shapeFilter) return false;
    if (onlyUsed && (usageCountMap.get(p.id) ?? 0) === 0) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      `${p.widthMm}x${p.heightMm}`.includes(q) ||
      `${p.widthMm}×${p.heightMm}`.includes(q) ||
      (p.description ?? "").toLowerCase().includes(q)
    );
  });

  const onSubmit = (values: ProfileFormValues) => {
    const finalHeight = values.shapeType === "square_tube" ? values.widthMm : values.heightMm;

    if (editingId) {
      updateProfile(editingId, {
        name: values.name,
        shapeType: values.shapeType,
        widthMm: values.widthMm,
        heightMm: finalHeight,
        wallThicknessMm: values.wallThicknessMm,
        pricePerMeter: values.pricePerMeter,
        color: values.color,
        description: values.description?.trim() || undefined,
      });
      setActionMessage(`Профиль «${values.name}» обновлён и сохранён в каталоге.`);
    } else {
      const createdId = addProfile({
        name: values.name,
        shapeType: values.shapeType,
        widthMm: values.widthMm,
        heightMm: finalHeight,
        wallThicknessMm: values.wallThicknessMm,
        pricePerMeter: values.pricePerMeter,
        color: values.color,
        description: values.description?.trim() || undefined,
      });
      setEditingId(createdId);
      setActionMessage(`Профиль «${values.name}» добавлен и выбран активным.`);
    }
  };

  const handleDelete = (profile: MaterialProfile) => {
    const res = deleteProfile(profile.id);
    if (!res.ok) {
      setActionMessage(res.reason ?? "Не удалось удалить профиль.");
      const fallback = project.profiles.find((p) => p.id !== profile.id);
      if (fallback) setReplaceTargetId(fallback.id);
      return;
    }
    if (editingId === profile.id) {
      resetToNewMode();
    }
    setActionMessage(`Профиль «${profile.name}» удалён.`);
  };

  const editingUsageCount = editingId ? (usageCountMap.get(editingId) ?? 0) : 0;

  // Параметры SVG-превью сечения
  const maxDim = Math.max(10, watchedWidth, watchedHeight);
  const svgScale = 68 / maxDim;
  const rectW = Math.max(8, watchedWidth * svgScale);
  const rectH = Math.max(8, (watchedShape === "square_tube" ? watchedWidth : watchedHeight) * svgScale);
  const wallPx = Math.max(1.5, Math.min(rectW / 3, rectH / 3, watchedWall * svgScale));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-4 backdrop-blur-xs">
      <div className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-[var(--mc-border-strong)] bg-[var(--mc-bg-panel)] text-[var(--mc-text)] shadow-2xl">
        {/* Шапка */}
        <div className="flex items-center justify-between border-b border-[var(--mc-border)] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--mc-text)]">
              Каталог профильных труб и материалов
            </h2>
            <p className="text-[11px] text-[var(--mc-text-muted)]">
              Создавайте и редактируйте профили. Цены и размеры задаются раздельно; изменения автоматически обновляют смету.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--mc-text-muted)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
            aria-label="Закрыть каталог"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Тело модального окна */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-12 lg:overflow-hidden">
          {/* Левая часть: поиск, фильтры и список */}
          <div className="flex min-h-0 flex-col border-b border-[var(--mc-border)] lg:col-span-7 lg:border-b-0 lg:border-r">
            <div className="space-y-2.5 border-b border-[var(--mc-border)] p-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--mc-text-subtle)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск по названию, размеру (40×20) или описанию..."
                    className="w-full rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] py-1.5 pl-8 pr-2.5 text-xs text-[var(--mc-text)] placeholder-[var(--mc-text-subtle)] outline-none focus:border-[var(--mc-brand-border)]"
                  />
                </div>
                <button
                  type="button"
                  onClick={resetToNewMode}
                  className="inline-flex items-center gap-1 rounded bg-[var(--mc-brand)] px-2.5 py-1.5 text-xs font-medium text-[var(--mc-brand-text)] hover:bg-[var(--mc-brand-light)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Создать профиль
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {(
                    [
                      { id: "all", label: "Все" },
                      { id: "rectangular_tube", label: "Прямоугольные" },
                      { id: "square_tube", label: "Квадратные" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setShapeFilter(item.id)}
                      className={`rounded border px-2 py-1 text-[11px] transition-colors ${
                        shapeFilter === item.id
                          ? "border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] text-[var(--mc-brand-inline)]"
                          : "border-[var(--mc-border)] bg-[var(--mc-bg-input)] text-[var(--mc-text-muted)] hover:text-[var(--mc-text)]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[var(--mc-text-muted)]">
                  <input
                    type="checkbox"
                    checked={onlyUsed}
                    onChange={(e) => setOnlyUsed(e.target.checked)}
                    className="accent-[var(--mc-brand)]"
                  />
                  Только используемые
                </label>
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {filteredProfiles.length === 0 ? (
                <div className="rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] p-6 text-center text-xs text-[var(--mc-text-subtle)]">
                  Профили по заданному фильтру не найдены.
                </div>
              ) : (
                filteredProfiles.map((profile) => {
                  const usedCount = usageCountMap.get(profile.id) ?? 0;
                  const isActive = activeProfileId === profile.id;
                  const isEditing = editingId === profile.id;

                  return (
                    <div
                      key={profile.id}
                      className={`flex items-center justify-between gap-3 rounded border p-2.5 transition-colors ${
                        isEditing
                          ? "border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)]"
                          : "border-[var(--mc-border)] bg-[var(--mc-bg-input)] hover:border-[var(--mc-border-strong)]"
                      }`}
                    >
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span
                          className="mt-1 h-4 w-2 shrink-0 rounded-xs"
                          style={{ backgroundColor: profile.color }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-xs font-semibold text-[var(--mc-text)]">
                              {profile.name}
                            </span>
                            {profile.isExample && (
                              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-[var(--mc-warning-text)]">
                                Пример
                              </span>
                            )}
                            {isActive && (
                              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-[var(--mc-success-text)]">
                                Активный
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[var(--mc-text-muted)]">
                            {formatProfileDimensions(profile)} ·{" "}
                            <strong className="text-[var(--mc-text)]">
                              {formatMoney(profile.pricePerMeter, project.calculationSettings.currency)}/м
                            </strong>
                            {usedCount > 0 && ` · В чертеже: ${usedCount} эл.`}
                          </div>
                          {profile.description && (
                            <div className="mt-0.5 truncate text-[10px] text-[var(--mc-text-subtle)]">
                              {profile.description}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setActiveProfileId(profile.id)}
                          className={`rounded border px-2 py-1 text-[11px] ${
                            isActive
                              ? "border-emerald-500/40 bg-emerald-500/15 text-[var(--mc-success-text)]"
                              : "border-[var(--mc-border-strong)] bg-[var(--mc-bg-elevated)] text-[var(--mc-text-secondary)] hover:text-[var(--mc-text)]"
                          }`}
                          title="Сделать активным для черчения"
                        >
                          {isActive ? "Выбран" : "Выбрать"}
                        </button>
                        <button
                          type="button"
                          onClick={() => fillFormFromProfile(profile)}
                          className="rounded border border-[var(--mc-border-strong)] bg-[var(--mc-bg-elevated)] p-1.5 text-[var(--mc-text-secondary)] hover:text-[var(--mc-text)]"
                          title="Редактировать профиль"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(profile)}
                          className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-[var(--mc-danger-text)] hover:bg-rose-500/20"
                          title="Удалить профиль"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Правая часть: форма создания / редактирования */}
          <div className="flex flex-col overflow-y-auto p-4 lg:col-span-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--mc-text-muted)]">
                {editingId ? "Редактирование профиля" : "Новый профиль"}
              </h3>
              {editingId && (
                <button
                  type="button"
                  onClick={resetToNewMode}
                  className="text-[11px] text-[var(--mc-brand-inline)] hover:underline"
                >
                  + Новый вместо правки
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              {/* Визуальное превью сечения */}
              <div className="flex items-center gap-4 rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] p-3">
                <svg
                  width="88"
                  height="88"
                  className="shrink-0 rounded border border-[var(--mc-border)] bg-[var(--mc-bg-canvas)]"
                >
                  <rect
                    x={(88 - rectW) / 2}
                    y={(88 - rectH) / 2}
                    width={rectW}
                    height={rectH}
                    fill={watchedColor}
                    fillOpacity={0.28}
                    stroke={watchedColor}
                    strokeWidth={2}
                  />
                  <rect
                    x={(88 - rectW) / 2 + wallPx}
                    y={(88 - rectH) / 2 + wallPx}
                    width={Math.max(2, rectW - wallPx * 2)}
                    height={Math.max(2, rectH - wallPx * 2)}
                    fill="var(--mc-bg-canvas)"
                    stroke={watchedColor}
                    strokeWidth={0.8}
                    strokeOpacity={0.6}
                  />
                </svg>
                <div className="space-y-1 text-xs">
                  <div className="font-medium text-[var(--mc-text)]">
                    {watchedWidth}×
                    {watchedShape === "square_tube" ? watchedWidth : watchedHeight}×
                    {watchedWall} мм
                  </div>
                  <div className="text-[11px] text-[var(--mc-text-muted)]">
                    Сечение:{" "}
                    {watchedShape === "square_tube"
                      ? "Квадратная труба"
                      : "Прямоугольная труба"}
                  </div>
                  <div className="text-[10px] text-[var(--mc-text-subtle)]">
                    Другие типы (круглая труба, уголок, швеллер, двутавр) подготовлены в архитектуре.
                  </div>
                </div>
              </div>

              <label className="block text-[11px] text-[var(--mc-text-muted)]">
                Тип сечения
                <select
                  {...register("shapeType")}
                  className="mt-1 w-full rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2.5 py-1.5 text-xs text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-border)]"
                >
                  {PROFILE_SHAPE_CATALOG.map((shape) => (
                    <option
                      key={shape.type}
                      value={shape.type}
                      disabled={!shape.implementedInMvp}
                    >
                      {shape.label}
                      {!shape.implementedInMvp ? " (в следующих версиях)" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-[11px] text-[var(--mc-text-muted)]">
                Название профиля
                <input
                  type="text"
                  {...register("name")}
                  placeholder="Например: Профиль 60×40×2"
                  className="mt-1 w-full rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2.5 py-1.5 text-xs text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-border)]"
                />
                {errors.name && (
                  <span className="mt-0.5 block text-[11px] text-[var(--mc-danger-text)]">
                    {errors.name.message}
                  </span>
                )}
              </label>

              <div className="grid grid-cols-3 gap-2">
                <label className="text-[11px] text-[var(--mc-text-muted)]">
                  Ширина, мм
                  <input
                    type="number"
                    step="1"
                    {...register("widthMm", { valueAsNumber: true })}
                    className="mt-1 w-full rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2 py-1.5 text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-border)]"
                  />
                  {errors.widthMm && (
                    <span className="mt-0.5 block text-[10px] text-[var(--mc-danger-text)]">
                      {errors.widthMm.message}
                    </span>
                  )}
                </label>

                <label className="text-[11px] text-[var(--mc-text-muted)]">
                  Высота, мм
                  <input
                    type="number"
                    step="1"
                    disabled={watchedShape === "square_tube"}
                    {...register("heightMm", { valueAsNumber: true })}
                    className="mt-1 w-full rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2 py-1.5 text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-border)] disabled:opacity-50"
                  />
                  {errors.heightMm && (
                    <span className="mt-0.5 block text-[10px] text-[var(--mc-danger-text)]">
                      {errors.heightMm.message}
                    </span>
                  )}
                </label>

                <label className="text-[11px] text-[var(--mc-text-muted)]">
                  Стенка, мм
                  <input
                    type="number"
                    step="0.5"
                    {...register("wallThicknessMm", { valueAsNumber: true })}
                    className="mt-1 w-full rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2 py-1.5 text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-border)]"
                  />
                  {errors.wallThicknessMm && (
                    <span className="mt-0.5 block text-[10px] text-[var(--mc-danger-text)]">
                      {errors.wallThicknessMm.message}
                    </span>
                  )}
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-[var(--mc-text-muted)]">
                  Цена за 1 погонный метр ({project.calculationSettings.currency})
                  <input
                    type="number"
                    step="1"
                    {...register("pricePerMeter", { valueAsNumber: true })}
                    className="mt-1 w-full rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2.5 py-1.5 text-xs tabular-nums text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-border)]"
                  />
                  {errors.pricePerMeter && (
                    <span className="mt-0.5 block text-[10px] text-[var(--mc-danger-text)]">
                      {errors.pricePerMeter.message}
                    </span>
                  )}
                </label>

                <div className="text-[11px] text-[var(--mc-text-muted)]">
                  Цвет отображения
                  <div className="mt-1 flex items-center gap-1.5">
                    <input
                      type="color"
                      {...register("color")}
                      className="h-8 w-10 cursor-pointer rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] p-0.5"
                    />
                    <div className="flex flex-wrap gap-1">
                      {COLOR_PRESETS.slice(0, 5).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setValue("color", preset, { shouldValidate: true })}
                          className="h-4 w-4 rounded-xs border border-black/20"
                          style={{ backgroundColor: preset }}
                          title={preset}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <label className="block text-[11px] text-[var(--mc-text-muted)]">
                Описание
                <textarea
                  rows={2}
                  {...register("description")}
                  placeholder="Назначение профиля, примечания по поставщику..."
                  className="mt-1 w-full rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-2.5 py-1.5 text-xs text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-border)]"
                />
              </label>

              {/* Замена профиля у элементов, если редактируемый профиль используется */}
              {editingId && editingUsageCount > 0 && project.profiles.length > 1 && (
                <div className="space-y-2 rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] p-2.5">
                  <div className="text-[11px] text-[var(--mc-text-secondary)]">
                    Используется в {editingUsageCount} элементах конструкции. Заменить на:
                  </div>
                  <div className="flex gap-1.5">
                    <select
                      value={replaceTargetId}
                      onChange={(e) => setReplaceTargetId(e.target.value)}
                      className="flex-1 rounded border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] px-2 py-1 text-xs text-[var(--mc-text)] outline-none"
                    >
                      <option value="">Выберите другой профиль...</option>
                      {project.profiles
                        .filter((p) => p.id !== editingId)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      disabled={!replaceTargetId}
                      onClick={() => {
                        if (editingId && replaceTargetId) {
                          replaceProfileInProject(editingId, replaceTargetId);
                          setActionMessage("Профиль заменён у всех элементов конструкции.");
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded border border-[var(--mc-border-strong)] bg-[var(--mc-bg-elevated)] px-2.5 py-1 text-xs text-[var(--mc-text)] hover:bg-[var(--mc-bg-hover)] disabled:opacity-40"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Заменить
                    </button>
                  </div>
                </div>
              )}

              {actionMessage && (
                <div className="rounded border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] px-2.5 py-1.5 text-xs text-[var(--mc-text)]">
                  {actionMessage}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (saveCatalogAsDefault()) {
                      setActionMessage("Каталог сохранён как шаблон для новых проектов.");
                    }
                  }}
                  className="rounded border border-[var(--mc-border-strong)] bg-[var(--mc-bg-elevated)] px-2.5 py-1.5 text-[11px] text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
                >
                  Сохранить как шаблон
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded bg-[var(--mc-brand)] px-3 py-1.5 text-xs font-medium text-[var(--mc-brand-text)] hover:bg-[var(--mc-brand-light)]"
                >
                  <Check className="h-3.5 w-3.5" />
                  {editingId ? "Сохранить изменения" : "Добавить в каталог"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
