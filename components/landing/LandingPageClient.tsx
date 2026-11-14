"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Box,
  Calculator,
  FileSpreadsheet,
  FileText,
  Layers,
  Moon,
  Sparkles,
  Sun,
} from "lucide-react";
import { AccountHeaderBadge } from "@/components/auth/AccountHeaderBadge";
import { useAuthStore } from "@/store/useAuthStore";
import { useThemeStore } from "@/store/useThemeStore";
import type { AuthUser } from "@/types";

interface LandingPageClientProps {
  initialUser: AuthUser | null;
}

type DemoPresetId = "canopy" | "truss" | "frame";

interface DemoPreset {
  id: DemoPresetId;
  label: string;
  size: string;
  length: string;
  joints: number;
  profile: string;
  cost: string;
  metalShare: number;
  weldShare: number;
  paintShare: number;
}

const DEMO_PRESETS: DemoPreset[] = [
  {
    id: "canopy",
    label: "Навес 6×4",
    size: "6 000 × 4 000 × 2 600 мм",
    length: "54.6 м",
    joints: 16,
    profile: "60×60×3 · 40×20×2",
    cost: "38 900 ₽",
    metalShare: 68,
    weldShare: 18,
    paintShare: 14,
  },
  {
    id: "truss",
    label: "Ферма 6 м",
    size: "6 000 × 750 мм",
    length: "28.4 м",
    joints: 12,
    profile: "40×40×2 · 25×25×2",
    cost: "19 450 ₽",
    metalShare: 62,
    weldShare: 24,
    paintShare: 14,
  },
  {
    id: "frame",
    label: "Стеллаж цех",
    size: "2 400 × 800 × 2 100 мм",
    length: "32.0 м",
    joints: 20,
    profile: "40×40×2",
    cost: "21 800 ₽",
    metalShare: 64,
    weldShare: 22,
    paintShare: 14,
  },
];

function IsometricPreviewSvg({ presetId }: { presetId: DemoPresetId }) {
  if (presetId === "truss") {
    return (
      <svg viewBox="0 0 360 210" className="w-full h-full" aria-hidden="true">
        {/* Нижний и верхний пояса фермы в объёме */}
        <polygon
          points="36,142 308,92 324,102 52,152"
          fill="none"
          stroke="#d97706"
          strokeWidth="4.5"
          strokeLinejoin="round"
        />
        <line x1="36" y1="88" x2="308" y2="38" stroke="#f59e0b" strokeWidth="5.5" strokeLinecap="round" />
        <line x1="36" y1="142" x2="308" y2="92" stroke="#f59e0b" strokeWidth="5.5" strokeLinecap="round" />
        {/* Стойки и раскосы */}
        <line x1="36" y1="88" x2="36" y2="142" stroke="#38bdf8" strokeWidth="4.5" />
        <line x1="126" y1="71" x2="126" y2="125" stroke="#38bdf8" strokeWidth="4.5" />
        <line x1="217" y1="55" x2="217" y2="109" stroke="#38bdf8" strokeWidth="4.5" />
        <line x1="308" y1="38" x2="308" y2="92" stroke="#38bdf8" strokeWidth="4.5" />

        <line x1="36" y1="142" x2="126" y2="71" stroke="#10b981" strokeWidth="3.5" />
        <line x1="126" y1="71" x2="217" y2="109" stroke="#10b981" strokeWidth="3.5" />
        <line x1="217" y1="109" x2="308" y2="38" stroke="#10b981" strokeWidth="3.5" />

        {[
          [36, 88],
          [36, 142],
          [126, 71],
          [126, 125],
          [217, 55],
          [217, 109],
          [308, 38],
          [308, 92],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="4.5" fill="#fbbf24" stroke="#121013" strokeWidth="1.5" />
        ))}
      </svg>
    );
  }

  if (presetId === "frame") {
    return (
      <svg viewBox="0 0 360 210" className="w-full h-full" aria-hidden="true">
        {/* Задний контур */}
        <line x1="115" y1="44" x2="115" y2="152" stroke="#9f4636" strokeWidth="4" />
        <line x1="265" y1="28" x2="265" y2="136" stroke="#9f4636" strokeWidth="4" />
        <line x1="115" y1="44" x2="265" y2="28" stroke="#9f4636" strokeWidth="4" />
        <line x1="115" y1="98" x2="265" y2="82" stroke="#9f4636" strokeWidth="3.5" />
        <line x1="115" y1="152" x2="265" y2="136" stroke="#9f4636" strokeWidth="4" />

        {/* Поперечины ярусов */}
        {[
          [75, 68, 115, 44],
          [225, 52, 265, 28],
          [75, 122, 115, 98],
          [225, 106, 265, 82],
          [75, 176, 115, 152],
          [225, 160, 265, 136],
        ].map(([x1, y1, x2, y2], idx) => (
          <line key={idx} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#38bdf8" strokeWidth="4" />
        ))}

        {/* Передний фасад */}
        <line x1="75" y1="68" x2="75" y2="176" stroke="#f59e0b" strokeWidth="5" />
        <line x1="225" y1="52" x2="225" y2="160" stroke="#f59e0b" strokeWidth="5" />
        <line x1="75" y1="68" x2="225" y2="52" stroke="#f59e0b" strokeWidth="5" />
        <line x1="75" y1="122" x2="225" y2="106" stroke="#10b981" strokeWidth="4.5" />
        <line x1="75" y1="176" x2="225" y2="160" stroke="#f59e0b" strokeWidth="5" />

        {[
          [75, 68],
          [225, 52],
          [75, 122],
          [225, 106],
          [75, 176],
          [225, 160],
          [115, 44],
          [265, 28],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="4.2" fill="#fbbf24" stroke="#121013" strokeWidth="1.5" />
        ))}
      </svg>
    );
  }

  // Навес 6x4 (по умолчанию)
  return (
    <svg viewBox="0 0 360 210" className="w-full h-full" aria-hidden="true">
      {/* Дальние стойки */}
      <line x1="128" y1="56" x2="128" y2="146" stroke="#9f4636" strokeWidth="4.5" />
      <line x1="286" y1="42" x2="286" y2="132" stroke="#9f4636" strokeWidth="4.5" />
      <line x1="128" y1="56" x2="286" y2="42" stroke="#d97706" strokeWidth="4.5" />

      {/* Стропила */}
      <line x1="70" y1="84" x2="128" y2="56" stroke="#38bdf8" strokeWidth="4.5" />
      <line x1="149" y1="77" x2="207" y2="49" stroke="#38bdf8" strokeWidth="4.5" />
      <line x1="228" y1="70" x2="286" y2="42" stroke="#38bdf8" strokeWidth="4.5" />

      {/* Укосины */}
      <line x1="70" y1="112" x2="96" y2="82" stroke="#10b981" strokeWidth="3.5" />
      <line x1="228" y1="98" x2="202" y2="72" stroke="#10b981" strokeWidth="3.5" />

      {/* Ближние стойки и балка */}
      <line x1="70" y1="84" x2="70" y2="176" stroke="#f59e0b" strokeWidth="5.5" />
      <line x1="228" y1="70" x2="228" y2="162" stroke="#f59e0b" strokeWidth="5.5" />
      <line x1="70" y1="84" x2="228" y2="70" stroke="#f59e0b" strokeWidth="5.5" />

      {/* Подписи размеров */}
      <line x1="70" y1="186" x2="228" y2="172" stroke="#867369" strokeWidth="1" strokeDasharray="3 3" />
      <text x="148" y="192" textAnchor="middle" fill="#b29e93" fontSize="10" fontFamily="monospace">
        6 000 мм
      </text>

      {[
        [70, 84],
        [228, 70],
        [128, 56],
        [286, 42],
        [149, 77],
        [207, 49],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="4.5" fill="#fbbf24" stroke="#121013" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

export function LandingPageClient({ initialUser }: LandingPageClientProps) {
  const storeUser = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const setUser = useAuthStore((s) => s.setUser);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const [activePresetId, setActivePresetId] = useState<DemoPresetId>("canopy");

  useEffect(() => {
    if (!initialized) {
      setUser(initialUser);
    }
  }, [initialized, initialUser, setUser]);

  const activeUser = initialized ? storeUser : initialUser;
  const activePreset =
    DEMO_PRESETS.find((p) => p.id === activePresetId) ?? DEMO_PRESETS[0];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--mc-bg-app)] text-[var(--mc-text)] flex flex-col">
      {/* Тонкое атмосферное свечение фона */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[760px] -translate-x-1/2 rounded-full opacity-25 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, rgba(159,70,54,0.65) 0%, rgba(108,45,44,0.25) 55%, transparent 80%)",
        }}
      />

      {/* Шапка */}
      <header className="sticky top-0 z-30 border-b border-[var(--mc-border)] bg-[var(--mc-bg-panel)]/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--mc-brand)] text-xs font-bold text-[var(--mc-brand-text)] shadow-xs">
              MC
            </div>
            <span className="text-sm font-semibold tracking-tight text-[var(--mc-text)]">
              MetalCalc
            </span>
          </Link>

          <div className="flex items-center gap-2">
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

            {activeUser ? (
              <>
                <Link
                  href="/projects"
                  className="hidden rounded border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--mc-text)] hover:bg-[var(--mc-bg-hover)] sm:inline-flex"
                >
                  Мои проекты
                </Link>
                <Link
                  href="/editor"
                  className="inline-flex items-center gap-1.5 rounded bg-[var(--mc-brand)] px-3 py-1.5 text-xs font-medium text-[var(--mc-brand-text)] hover:bg-[var(--mc-brand-light)] transition-colors"
                >
                  <span>В редактор</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <AccountHeaderBadge />
              </>
            ) : (
              <>
                <Link
                  href="/login?next=%2Feditor"
                  className="rounded border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--mc-text)] hover:bg-[var(--mc-bg-hover)]"
                >
                  Войти
                </Link>
                <Link
                  href="/register?next=%2Feditor"
                  className="inline-flex items-center gap-1.5 rounded bg-[var(--mc-brand)] px-3 py-1.5 text-xs font-medium text-[var(--mc-brand-text)] hover:bg-[var(--mc-brand-light)] transition-colors"
                >
                  <span>Начать</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        {/* Главный экран (Hero + живой превью-виджет) */}
        <section className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6 lg:pb-16 lg:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-12">
            {/* Левый блок: лаконичный хук */}
            <div className="space-y-6 lg:col-span-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] px-3 py-1 text-[11px] font-medium text-[var(--mc-brand-inline)]">
                <Sparkles className="h-3.5 w-3.5" />
                <span>2D чертёж · 3D модель · Автосмета</span>
              </div>

              <h1 className="text-3xl font-bold leading-[1.12] tracking-tight text-[var(--mc-text)] sm:text-5xl">
                Начертите каркас.{" "}
                <span className="text-[var(--mc-brand-inline)]">Смету посчитает сам.</span>
              </h1>

              <p className="max-w-lg text-sm leading-relaxed text-[var(--mc-text-secondary)] sm:text-base">
                Быстрое проектирование конструкций из профильной трубы прямо в браузере — от
                трёхмерного эскиза до готовых PDF и Excel для цеха и клиента.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href={activeUser ? "/editor" : "/register?next=%2Feditor"}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--mc-brand)] px-5 py-3 text-sm font-medium text-[var(--mc-brand-text)] shadow-sm transition-all hover:bg-[var(--mc-brand-light)]"
                >
                  <span>{activeUser ? "Открыть холст" : "Попробовать бесплатно"}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  href={activeUser ? "/projects" : "/login?next=%2Feditor"}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] px-5 py-3 text-sm font-medium text-[var(--mc-text)] transition-colors hover:bg-[var(--mc-bg-hover)]"
                >
                  <span>{activeUser ? "Мои проекты" : "Войти"}</span>
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-xs text-[var(--mc-text-muted)]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--mc-brand-light)]" />
                  Точность до 1 мм
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--mc-brand-light)]" />
                  Реальные 3D-длины
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--mc-brand-light)]" />
                  Выгрузка в PDF и Excel
                </span>
              </div>
            </div>

            {/* Правый блок: интерактивная демонстрация расчёта */}
            <div className="lg:col-span-6">
              <div className="rounded-2xl border border-[var(--mc-border-strong)] bg-[var(--mc-bg-panel)] p-3.5 shadow-xl">
                {/* Переключатель примеров */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--mc-border)] pb-3">
                  <div className="flex items-center gap-1 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-app)] p-0.5">
                    {DEMO_PRESETS.map((preset) => {
                      const active = preset.id === activePreset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setActivePresetId(preset.id)}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            active
                              ? "bg-[var(--mc-brand)] text-[var(--mc-brand-text)] shadow-xs"
                              : "text-[var(--mc-text-muted)] hover:text-[var(--mc-text)]"
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                  <span className="font-mono text-[11px] text-[var(--mc-text-subtle)]">
                    {activePreset.size}
                  </span>
                </div>

                {/* Сетка чертежа + 3D изометрия */}
                <div className="relative mt-3 h-52 overflow-hidden rounded-xl border border-[var(--mc-border)] bg-[var(--mc-bg-canvas)] p-3">
                  <div
                    className="pointer-events-none absolute inset-0 opacity-35"
                    style={{
                      backgroundImage:
                        "linear-gradient(to right, var(--mc-border) 1px, transparent 1px), linear-gradient(to bottom, var(--mc-border) 1px, transparent 1px)",
                      backgroundSize: "22px 22px",
                    }}
                  />

                  <div className="relative z-10 flex items-center justify-between text-[10px] text-[var(--mc-text-muted)]">
                    <span className="rounded border border-[var(--mc-border)] bg-[var(--mc-bg-panel)]/90 px-2 py-0.5 font-medium">
                      3D-модель · X / Y / Z
                    </span>
                    <span className="rounded border border-[var(--mc-border)] bg-[var(--mc-bg-panel)]/90 px-2 py-0.5 font-mono">
                      {activePreset.profile}
                    </span>
                  </div>

                  <div className="relative z-10 h-40">
                    <IsometricPreviewSvg presetId={activePreset.id} />
                  </div>
                </div>

                {/* Живая строка сметы */}
                <div className="mt-3 rounded-xl border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <div className="text-[10px] text-[var(--mc-text-muted)]">Металл</div>
                        <div className="font-semibold tabular-nums text-[var(--mc-text)]">
                          {activePreset.length}
                        </div>
                      </div>
                      <div className="h-6 w-px bg-[var(--mc-border)]" />
                      <div>
                        <div className="text-[10px] text-[var(--mc-text-muted)]">Узлы сварки</div>
                        <div className="font-semibold tabular-nums text-[var(--mc-text)]">
                          {activePreset.joints} шт.
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] text-[var(--mc-text-muted)]">Итого смета</div>
                      <div className="text-base font-bold tabular-nums text-[var(--mc-brand-inline)]">
                        {activePreset.cost}
                      </div>
                    </div>
                  </div>

                  {/* Шкала структуры бюджета */}
                  <div className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-[var(--mc-border)]">
                    <div
                      style={{ width: `${activePreset.metalShare}%` }}
                      className="bg-[#f59e0b] transition-all duration-300"
                      title="Металлопрокат"
                    />
                    <div
                      style={{ width: `${activePreset.weldShare}%` }}
                      className="bg-[#9f4636] transition-all duration-300"
                      title="Сварка"
                    />
                    <div
                      style={{ width: `${activePreset.paintShare}%` }}
                      className="bg-[#38bdf8] transition-all duration-300"
                      title="Покраска"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Компактный Bento-блок */}
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="grid gap-3.5 md:grid-cols-12">
            {/* Карточка 1 */}
            <div className="rounded-xl border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-5 md:col-span-5">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] text-[var(--mc-brand-inline)]">
                  <Layers className="h-4 w-4" />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--mc-text-subtle)]">
                  XY · XZ · YZ
                </span>
              </div>
              <h2 className="mt-4 text-sm font-semibold text-[var(--mc-text)]">
                Три проекции на одном экране
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--mc-text-muted)]">
                Вид сверху, спереди и сбоку с расчётом реальной пространственной длины каждого
                раскоса.
              </p>
            </div>

            {/* Карточка 2 */}
            <div className="rounded-xl border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-5 md:col-span-4">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] text-[var(--mc-brand-inline)]">
                  <Box className="h-4 w-4" />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--mc-text-subtle)]">
                  3D сцена
                </span>
              </div>
              <h2 className="mt-4 text-sm font-semibold text-[var(--mc-text)]">
                Объём и стыковка торцов
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--mc-text-muted)]">
                Полые профильные трубы, вращение камеры и правка координат по всем трём осям.
              </p>
            </div>

            {/* Карточка 3 */}
            <div className="rounded-xl border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-5 md:col-span-3">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] text-[var(--mc-brand-inline)]">
                  <Calculator className="h-4 w-4" />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--mc-text-subtle)]">
                  ₽ · $ · €
                </span>
              </div>
              <h2 className="mt-4 text-sm font-semibold text-[var(--mc-text)]">
                Смета на лету
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--mc-text-muted)]">
                Автоподсчёт металла, швов и покраски по вашим тарифам.
              </p>
            </div>

            {/* Карточка 4: Экспорт + CTA */}
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] p-5 sm:flex-row sm:items-center md:col-span-12">
              <div className="flex items-start gap-3.5">
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] text-[var(--mc-success-text)]">
                    <FileSpreadsheet className="h-4 w-4" />
                  </span>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] text-[var(--mc-brand-inline)]">
                    <FileText className="h-4 w-4" />
                  </span>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[var(--mc-text)]">
                    Готовая спецификация в PDF и Excel в один клик
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--mc-text-secondary)]">
                    Ведомость деталей, чертежи с трёх сторон и итоговый расчёт для заказчика или
                    производства.
                  </p>
                </div>
              </div>

              <Link
                href={activeUser ? "/editor" : "/register?next=%2Feditor"}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--mc-brand)] px-4 py-2.5 text-xs font-medium text-[var(--mc-brand-text)] shadow-xs transition-colors hover:bg-[var(--mc-brand-light)]"
              >
                <span>{activeUser ? "Перейти в редактор" : "Начать проект"}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--mc-border)] bg-[var(--mc-bg-panel)] py-5 text-xs text-[var(--mc-text-subtle)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <span>
            <strong className="font-semibold text-[var(--mc-text)]">MetalCalc</strong> · Проектирование и смета металлоконструкций
          </span>
          <div className="flex items-center gap-4">
            <Link href="/editor" className="hover:text-[var(--mc-text)]">
              Редактор
            </Link>
            <Link href="/projects" className="hover:text-[var(--mc-text)]">
              Проекты
            </Link>
            <Link href="/login?next=%2Feditor" className="hover:text-[var(--mc-text)]">
              Вход
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
