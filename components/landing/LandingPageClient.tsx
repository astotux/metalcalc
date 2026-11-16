"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Box,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Compass,
  Crosshair,
  FileSpreadsheet,
  FileText,
  GitCommitHorizontal,
  Grid3x3,
  Layers,
  Moon,
  Paintbrush,
  Ruler,
  Scissors,
  ShieldCheck,
  SlidersHorizontal,
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

const JOINT_MODES = [
  {
    title: "Запил на ус (под углом)",
    description:
      "Две трубы сходятся в углу рамы или фермы. Оба торца автоматически подрезаются под половину угла на чертеже и в 3D.",
  },
  {
    title: "Встык (Т-примыкание)",
    description:
      "Одна труба идёт насквозь, вторая упирается точно в её стенку. Сквозную трубу можно выбрать в свойствах узла.",
  },
  {
    title: "Оценка сварного шва",
    description:
      "Не обязательно мерить каждый шов вручную — длина шва подставляется по периметру меньшей из стыкуемых труб.",
  },
  {
    title: "Прямой рез без подрезки",
    description:
      "Для нахлёста или конструкций, где заготовки пилятся под 90° и прикладываются друг к другу без косых срезов.",
  },
];

const FAQ_ITEMS = [
  {
    q: "В каких единицах работает чертёж и как считается длина наклонных деталей?",
    a: "Черчение идёт в миллиметрах, а итоговый расход в смете переводится в погонные метры. Длина каждого раскоса и стропила считается по реальному положению в пространстве, а не по плоской проекции.",
  },
  {
    q: "Можно ли забить свои цены на трубу, сварку и покраску?",
    a: "Да. В каталоге профилей вы задаёте нужные сечения (прямоугольную и квадратную трубу), толщину стенки и цену за погонный метр. Тарифы на покраску и сварку настраиваются прямо в проекте и в разделе настроек.",
  },
  {
    q: "Заменяет ли MetalCalc инженерный прочностной расчёт?",
    a: "Нет. Программа предназначена для проектирования геометрии, проверки стыков и расчёта стоимости материалов и работ. Для ответственных сооружений сечение трубы нужно проверять по нагрузкам отдельно.",
  },
  {
    q: "Как сохраняются проекты и можно ли работать с другого компьютера?",
    a: "Все ваши проекты и настроенный каталог труб сохраняются в вашем аккаунте. Войти можно по электронной почте или через Яндекс ID.",
  },
];

function IsometricPreviewSvg({ presetId }: { presetId: DemoPresetId }) {
  if (presetId === "truss") {
    return (
      <svg viewBox="0 0 360 210" className="h-full w-full" aria-hidden="true">
        <polygon
          points="36,142 308,92 324,102 52,152"
          fill="none"
          stroke="#d97706"
          strokeWidth="4.5"
          strokeLinejoin="round"
        />
        <line x1="36" y1="88" x2="308" y2="38" stroke="#f59e0b" strokeWidth="5.5" strokeLinecap="round" />
        <line x1="36" y1="142" x2="308" y2="92" stroke="#f59e0b" strokeWidth="5.5" strokeLinecap="round" />
        <line x1="36" y1="88" x2="36" y2="142" stroke="#38bdf8" strokeWidth="4.5" />
        <line x1="126" y1="71" x2="126" y2="125" stroke="#38bdf8" strokeWidth="4.5" />
        <line x1="217" y1="55" x2="217" y2="109" stroke="#38bdf8" strokeWidth="4.5" />
        <line x1="308" y1="38" x2="308" y2="92" stroke="#38bdf8" strokeWidth="4.5" />

        <line x1="36" y1="142" x2="126" y2="71" stroke="#10b981" strokeWidth="3.5" />
        <line x1="126" y1="71" x2="217" y2="109" stroke="#10b981" strokeWidth="3.5" />
        <line x1="217" y1="109" x2="308" y2="38" stroke="#10b981" strokeWidth="3.5" />

        <line x1="36" y1="164" x2="308" y2="114" stroke="#768196" strokeWidth="1" strokeDasharray="3 3" />
        <text x="172" y="160" textAnchor="middle" fill="#949eb0" fontSize="10" fontFamily="monospace">
          6 000 мм · пролёт
        </text>

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
          <circle key={i} cx={cx} cy={cy} r="4.5" fill="#fbbf24" stroke="#080a0e" strokeWidth="1.5" />
        ))}
      </svg>
    );
  }

  if (presetId === "frame") {
    return (
      <svg viewBox="0 0 360 210" className="h-full w-full" aria-hidden="true">
        <line x1="115" y1="44" x2="115" y2="152" stroke="#cb5843" strokeWidth="4" />
        <line x1="265" y1="28" x2="265" y2="136" stroke="#cb5843" strokeWidth="4" />
        <line x1="115" y1="44" x2="265" y2="28" stroke="#cb5843" strokeWidth="4" />
        <line x1="115" y1="98" x2="265" y2="82" stroke="#cb5843" strokeWidth="3.5" />
        <line x1="115" y1="152" x2="265" y2="136" stroke="#cb5843" strokeWidth="4" />

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
          <circle key={i} cx={cx} cy={cy} r="4.2" fill="#fbbf24" stroke="#080a0e" strokeWidth="1.5" />
        ))}
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 360 210" className="h-full w-full" aria-hidden="true">
      <line x1="128" y1="56" x2="128" y2="146" stroke="#cb5843" strokeWidth="4.5" />
      <line x1="286" y1="42" x2="286" y2="132" stroke="#cb5843" strokeWidth="4.5" />
      <line x1="128" y1="56" x2="286" y2="42" stroke="#d97706" strokeWidth="4.5" />

      <line x1="70" y1="84" x2="128" y2="56" stroke="#38bdf8" strokeWidth="4.5" />
      <line x1="149" y1="77" x2="207" y2="49" stroke="#38bdf8" strokeWidth="4.5" />
      <line x1="228" y1="70" x2="286" y2="42" stroke="#38bdf8" strokeWidth="4.5" />

      <line x1="70" y1="112" x2="96" y2="82" stroke="#10b981" strokeWidth="3.5" />
      <line x1="228" y1="98" x2="202" y2="72" stroke="#10b981" strokeWidth="3.5" />

      <line x1="70" y1="84" x2="70" y2="176" stroke="#f59e0b" strokeWidth="5.5" />
      <line x1="228" y1="70" x2="228" y2="162" stroke="#f59e0b" strokeWidth="5.5" />
      <line x1="70" y1="84" x2="228" y2="70" stroke="#f59e0b" strokeWidth="5.5" />

      <line x1="70" y1="186" x2="228" y2="172" stroke="#768196" strokeWidth="1" strokeDasharray="3 3" />
      <text x="148" y="193" textAnchor="middle" fill="#949eb0" fontSize="10" fontFamily="monospace">
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
        <circle key={i} cx={cx} cy={cy} r="4.5" fill="#fbbf24" stroke="#080a0e" strokeWidth="1.5" />
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
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[var(--mc-bg-app)] text-[var(--mc-text)]">
      {/* Фоновая сетка чертежа */}
      <div
        aria-hidden="true"
        className="mc-blueprint-grid pointer-events-none absolute inset-x-0 top-0 h-[620px] opacity-30 [mask-image:linear-gradient(to_bottom,black_30%,transparent_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-44 left-1/2 h-[420px] w-[760px] -translate-x-1/2 rounded-full opacity-20 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, rgba(203,88,67,0.7) 0%, rgba(181,72,52,0.22) 55%, transparent 80%)",
        }}
      />

      {/* Шапка */}
      <header className="sticky top-0 z-30 border-b border-[var(--mc-border)] bg-[var(--mc-bg-panel)]/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--mc-brand)] font-mono text-xs font-bold text-[var(--mc-brand-text)] shadow-xs">
                MC
              </div>
              <span className="text-sm font-semibold tracking-tight text-[var(--mc-text)]">
                MetalCalc
              </span>
            </Link>

            <nav className="hidden items-center gap-5 text-xs font-medium text-[var(--mc-text-muted)] lg:flex">
              <a href="#workspace" className="transition-colors hover:text-[var(--mc-text)]">
                2D и 3D
              </a>
              <a href="#joints" className="transition-colors hover:text-[var(--mc-text)]">
                Стыки труб
              </a>
              <a href="#pricing" className="transition-colors hover:text-[var(--mc-text)]">
                Профили и смета
              </a>
              <a href="#export" className="transition-colors hover:text-[var(--mc-text)]">
                PDF и Excel
              </a>
              <a href="#faq" className="transition-colors hover:text-[var(--mc-text)]">
                Вопросы
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-2">
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

            {activeUser ? (
              <>
                <Link
                  href="/projects"
                  className="hidden rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--mc-text)] transition-colors hover:bg-[var(--mc-bg-hover)] sm:inline-flex"
                >
                  Мои проекты
                </Link>
                <Link
                  href="/editor"
                  className="inline-flex items-center gap-1.5 rounded-md bg-[var(--mc-brand)] px-3.5 py-1.5 text-xs font-medium text-[var(--mc-brand-text)] transition-colors hover:bg-[var(--mc-brand-light)]"
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
                  className="rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--mc-text)] transition-colors hover:bg-[var(--mc-bg-hover)]"
                >
                  Войти
                </Link>
                <Link
                  href="/register?next=%2Feditor"
                  className="inline-flex items-center gap-1.5 rounded-md bg-[var(--mc-brand)] px-3.5 py-1.5 text-xs font-medium text-[var(--mc-brand-text)] transition-colors hover:bg-[var(--mc-brand-light)]"
                >
                  <span>Создать аккаунт</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        {/* Главный экран (Hero + живой пример) */}
        <section className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6 lg:pb-16 lg:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] px-3 py-1 font-mono text-[11px] font-medium text-[var(--mc-brand-inline)]">
                ПРОЕКТИРОВАНИЕ И СМЕТА МЕТАЛЛОКОНСТРУКЦИЙ
              </div>

              <h1 className="text-3xl font-bold leading-[1.1] tracking-tight text-[var(--mc-text)] sm:text-5xl">
                Начертите каркас.{" "}
                <span className="text-[var(--mc-brand-inline)]">
                  Метраж, стыки и смету посчитает программа.
                </span>
              </h1>

              <p className="max-w-xl text-sm leading-relaxed text-[var(--mc-text-secondary)] sm:text-base">
                MetalCalc — рабочая программа для расчёта навесов, ферм, ворот, верстаков и
                стеллажей из профильной трубы. Вы рисуете каркас в 2D и проверяете в 3D, а
                программа сразу считает закупочный метраж, количество швов, покраску и готовит PDF
                с Excel.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href={activeUser ? "/editor" : "/register?next=%2Feditor"}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--mc-brand)] px-5 py-3 text-sm font-semibold text-[var(--mc-brand-text)] shadow-sm transition-colors hover:bg-[var(--mc-brand-light)]"
                >
                  <span>{activeUser ? "Открыть редактор" : "Начать работу"}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  href={activeUser ? "/projects" : "/login?next=%2Feditor"}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--mc-border-strong)] bg-[var(--mc-bg-panel)] px-5 py-3 text-sm font-medium text-[var(--mc-text)] transition-colors hover:bg-[var(--mc-bg-hover)]"
                >
                  <span>{activeUser ? "Мои проекты" : "У меня уже есть аккаунт"}</span>
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-3 border-t border-[var(--mc-border)] pt-5">
                <div>
                  <div className="font-mono text-sm font-semibold text-[var(--mc-text)]">до 1 мм</div>
                  <div className="mt-0.5 text-[11px] text-[var(--mc-text-muted)]">
                    Точность размеров и привязок
                  </div>
                </div>
                <div>
                  <div className="font-mono text-sm font-semibold text-[var(--mc-text)]">XY · XZ · YZ</div>
                  <div className="mt-0.5 text-[11px] text-[var(--mc-text-muted)]">
                    Три вида и объёмная 3D-модель
                  </div>
                </div>
                <div>
                  <div className="font-mono text-sm font-semibold text-[var(--mc-text)]">PDF + XLSX</div>
                  <div className="mt-0.5 text-[11px] text-[var(--mc-text-muted)]">
                    Чертежи и ведомость резки
                  </div>
                </div>
              </div>
            </div>

            {/* Правый блок: интерактивная демонстрация расчёта */}
            <div className="lg:col-span-6">
              <div className="overflow-hidden rounded-2xl border border-[var(--mc-border-strong)] bg-[var(--mc-bg-panel)] shadow-2xl">
                <div className="flex items-center justify-between border-b border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Compass className="h-3.5 w-3.5 text-[var(--mc-brand-inline)]" />
                    <span className="font-mono text-[11px] font-medium text-[var(--mc-text-secondary)]">
                      Пример расчёта
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-[var(--mc-text-muted)]">
                    {activePreset.size}
                  </span>
                </div>

                <div className="p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                    <div
                      className="flex items-center gap-1 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-app)] p-0.5"
                      role="tablist"
                      aria-label="Примеры конструкций"
                    >
                      {DEMO_PRESETS.map((preset) => {
                        const active = preset.id === activePreset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setActivePresetId(preset.id)}
                            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
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
                    <span className="rounded border border-[var(--mc-border)] bg-[var(--mc-bg-app)] px-2 py-1 font-mono text-[10px] text-[var(--mc-text-secondary)]">
                      {activePreset.profile}
                    </span>
                  </div>

                  <div className="relative h-52 overflow-hidden rounded-xl border border-[var(--mc-border)] bg-[var(--mc-bg-canvas)] p-3">
                    <div
                      className="pointer-events-none absolute inset-0 opacity-45"
                      style={{
                        backgroundImage:
                          "linear-gradient(to right, var(--mc-border) 1px, transparent 1px), linear-gradient(to bottom, var(--mc-border) 1px, transparent 1px)",
                        backgroundSize: "22px 22px",
                      }}
                    />

                    <div className="relative z-10 flex items-center justify-between text-[10px] text-[var(--mc-text-muted)]">
                      <span className="inline-flex items-center gap-1.5 rounded border border-[var(--mc-border)] bg-[var(--mc-bg-panel)]/90 px-2 py-0.5 font-mono">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        3D-СЦЕНА
                      </span>
                      <span className="rounded border border-[var(--mc-border)] bg-[var(--mc-bg-panel)]/90 px-2 py-0.5 font-mono">
                        X / Y / Z
                      </span>
                    </div>

                    <div className="relative z-10 h-40">
                      <IsometricPreviewSvg presetId={activePreset.id} />
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] p-3.5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 text-xs">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-[var(--mc-text-muted)]">
                            Профтруба
                          </div>
                          <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[var(--mc-text)]">
                            {activePreset.length}
                          </div>
                        </div>
                        <div className="h-7 w-px bg-[var(--mc-border)]" />
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-[var(--mc-text-muted)]">
                            Стыки сварки
                          </div>
                          <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[var(--mc-text)]">
                            {activePreset.joints} шт.
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-[var(--mc-text-muted)]">
                          Итого смета
                        </div>
                        <div className="mt-0.5 font-mono text-lg font-bold tabular-nums text-[var(--mc-brand-inline)]">
                          {activePreset.cost}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-[var(--mc-border)]">
                      <div
                        style={{ width: `${activePreset.metalShare}%` }}
                        className="bg-amber-500 transition-all duration-300"
                        title="Металлопрокат"
                      />
                      <div
                        style={{ width: `${activePreset.weldShare}%` }}
                        className="bg-[var(--mc-brand-light)] transition-all duration-300"
                        title="Сварка"
                      />
                      <div
                        style={{ width: `${activePreset.paintShare}%` }}
                        className="bg-sky-400 transition-all duration-300"
                        title="Покраска"
                      />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[var(--mc-text-muted)]">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-xs bg-amber-500" />
                        Металл {activePreset.metalShare}%
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-xs bg-[var(--mc-brand-light)]" />
                        Сварка {activePreset.weldShare}%
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-xs bg-sky-400" />
                        Покраска {activePreset.paintShare}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Секция 1: 2D-виды и 3D-модель */}
        <section id="workspace" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="mb-7 max-w-2xl space-y-2">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--mc-brand-inline)]">
              01 · Черчение в 2D и 3D
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--mc-text)] sm:text-3xl">
              Один каркас — и на плоских чертежах, и в объёме
            </h2>
            <p className="text-sm leading-relaxed text-[var(--mc-text-muted)]">
              Любое изменение на виде сверху сразу видно спереди, сбоку и в 3D-сцене. Не нужно
              сводить разные чертежи вручную и пересчитывать длины наклонных труб.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            <div className="rounded-2xl border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-6 lg:col-span-6">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] text-[var(--mc-brand-inline)]">
                  <Layers className="h-4 w-4" />
                </div>
                <span className="rounded border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-2 py-0.5 font-mono text-[10px] text-[var(--mc-text-muted)]">
                  XY · XZ · YZ
                </span>
              </div>

              <h3 className="mt-4 text-base font-semibold text-[var(--mc-text)]">
                Три ортогональных вида на одном экране
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--mc-text-muted)]">
                Сверху, спереди и сбоку с настраиваемым шагом сетки. Если нужно сосредоточиться на
                плане, вид сверху разворачивается на всё рабочее поле в один клик.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-[var(--mc-text-secondary)]">
                <div className="flex items-center gap-2 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-app)] px-3 py-2">
                  <Grid3x3 className="h-3.5 w-3.5 shrink-0 text-[var(--mc-brand-inline)]" />
                  <span>Привязка к сетке (мм)</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-app)] px-3 py-2">
                  <Crosshair className="h-3.5 w-3.5 shrink-0 text-[var(--mc-brand-inline)]" />
                  <span>К концам и пересечениям</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-app)] px-3 py-2">
                  <Ruler className="h-3.5 w-3.5 shrink-0 text-[var(--mc-brand-inline)]" />
                  <span>Привязка к углам 45°</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-app)] px-3 py-2">
                  <Calculator className="h-3.5 w-3.5 shrink-0 text-[var(--mc-brand-inline)]" />
                  <span>Точная 3D-длина укосин</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-6 lg:col-span-6">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] text-[var(--mc-brand-inline)]">
                  <Box className="h-4 w-4" />
                </div>
                <span className="rounded border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-2 py-0.5 font-mono text-[10px] text-[var(--mc-text-muted)]">
                  3D-режим
                </span>
              </div>

              <h3 className="mt-4 text-base font-semibold text-[var(--mc-text)]">
                Объёмная модель с реальным сечением труб
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--mc-text-muted)]">
                Каждая труба строится по своим размерам и толщине стенки. В 3D можно крутить
                конструкцию со всех сторон, дорисовывать балки на нужной высоте и двигать детали
                стрелками по осям.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-[var(--mc-text-secondary)]">
                <div className="rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-app)] px-3 py-2">
                  Виды: изометрия, сверху, спереди, сбоку
                </div>
                <div className="rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-app)] px-3 py-2">
                  Рабочие плоскости на любой высоте
                </div>
                <div className="rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-app)] px-3 py-2">
                  Сдвиг всей трубы или отдельного торца
                </div>
                <div className="rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-app)] px-3 py-2">
                  Правка точной длины детали в мм
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Секция 2: Узлы сварки и подрезка торцов */}
        <section id="joints" className="border-y border-[var(--mc-border)] bg-[var(--mc-bg-panel)]/50">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl space-y-2">
                <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--mc-brand-inline)]">
                  02 · Стыки и сварные швы
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-[var(--mc-text)] sm:text-3xl">
                  Подрезка торцов и расчёт сварки
                </h2>
                <p className="text-sm leading-relaxed text-[var(--mc-text-muted)]">
                  Программа сама находит углы, Т-примыкания и пересечения труб. Длину шва можно
                  считать либо по количеству соединений, либо в метрах шва с оценкой по периметру
                  трубы.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] px-3 py-2 text-xs text-[var(--mc-text-secondary)]">
                <GitCommitHorizontal className="h-4 w-4 text-[var(--mc-warning-text)]" />
                <span>За стык или за погонный метр шва</span>
              </div>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              {JOINT_MODES.map((mode) => (
                <div
                  key={mode.title}
                  className="flex flex-col justify-between rounded-xl border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-4"
                >
                  <div>
                    <Scissors className="h-4 w-4 text-[var(--mc-brand-inline)]" />
                    <h3 className="mt-3 text-sm font-semibold text-[var(--mc-text)]">
                      {mode.title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-[var(--mc-text-muted)]">
                      {mode.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Секция 3: Профили и смета */}
        <section id="pricing" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="mb-7 max-w-2xl space-y-2">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--mc-brand-inline)]">
              03 · Каталог труб и расчёт стоимости
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--mc-text)] sm:text-3xl">
              Свой прайс на металл, сварку и покраску
            </h2>
            <p className="text-sm leading-relaxed text-[var(--mc-text-muted)]">
              Задайте цены вашей металлобазы и расценки на работы — смета обновляется автоматически
              при добавлении или изменении каждой трубы.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] text-[var(--mc-brand-inline)]">
                <SlidersHorizontal className="h-4 w-4" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-[var(--mc-text)]">
                Каталог профильных труб
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--mc-text-muted)]">
                Квадратные и прямоугольные трубы любых размеров и толщины стенки. Для каждого
                профиля задаются цвет на чертеже и цена за метр — её можно заменить сразу у всех
                деталей проекта.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] text-[var(--mc-brand-inline)]">
                <Paintbrush className="h-4 w-4" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-[var(--mc-text)]">
                Учёт покраски по деталям
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--mc-text-muted)]">
                Покраска считается по общей длине деталей. Отдельные элементы легко исключить из
                покраски в один клик — например, закладные или бетонируемую часть опорных столбов.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] text-[var(--mc-brand-inline)]">
                <Calculator className="h-4 w-4" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-[var(--mc-text)]">
                Гибкие тарифы и 5 валют
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--mc-text-muted)]">
                Считайте смету в рублях (₽), долларах ($), евро (€), тенге (₸) или белорусских
                рублях (Br). Итоговая сумма всегда видна в нижней панели редактора.
              </p>
            </div>
          </div>
        </section>

        {/* Секция 4: Что попадает в PDF и Excel */}
        <section id="export" className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
          <div className="mb-6 max-w-2xl space-y-2">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--mc-brand-inline)]">
              04 · Выгрузка документов
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--mc-text)] sm:text-3xl">
              Готовые файлы для заказчика и для цеха
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] text-[var(--mc-brand-inline)]">
                  <FileText className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-[var(--mc-text)]">
                    Отчёт в PDF (.pdf)
                  </h3>
                  <p className="text-xs text-[var(--mc-text-muted)]">
                    Удобно отправить клиенту на согласование
                  </p>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-xs text-[var(--mc-text-secondary)]">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--mc-success-text)]" />
                  <span>Чертежи конструкции с трёх сторон (XY, XZ, YZ) с габаритами и цветами профилей.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--mc-success-text)]" />
                  <span>Таблица материалов, стоимость сварки, покраски и итоговая цена.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--mc-success-text)]" />
                  <span>Ведомость всех деталей с длиной каждого отрезка.</span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--mc-success-border)] bg-[var(--mc-success-soft)] text-[var(--mc-success-text)]">
                  <FileSpreadsheet className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-[var(--mc-text)]">
                    Книга Excel (.xlsx)
                  </h3>
                  <p className="text-xs text-[var(--mc-text-muted)]">
                    Для закупки металла и раскроя в цехе
                  </p>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-xs text-[var(--mc-text-secondary)]">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--mc-success-text)]" />
                  <span>Лист «Смета и материалы» — метраж по каждому профилю, цены, работы и итог.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--mc-success-text)]" />
                  <span>Лист «Спецификация элементов» — список всех заготовок с пометками и размерами.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--mc-success-text)]" />
                  <span>Копирование краткой текстовой сметы для быстрой отправки в мессенджер.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Секция 5: Частые вопросы */}
        <section id="faq" className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
          <div className="mb-6 space-y-1.5">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--mc-brand-inline)]">
              05 · Частые вопросы
            </div>
            <h2 className="text-xl font-bold tracking-tight text-[var(--mc-text)] sm:text-2xl">
              Коротко о работе с программой
            </h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-4 open:border-[var(--mc-border-strong)]"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-[var(--mc-text)]">
                  <span>{item.q}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-[var(--mc-text-muted)] transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2.5 border-t border-[var(--mc-border)] pt-2.5 text-xs leading-relaxed text-[var(--mc-text-muted)]">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Финальный CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] p-6 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[var(--mc-text)] sm:text-lg">
                Попробуйте собрать свой первый проект
              </h2>
              <p className="text-xs text-[var(--mc-text-secondary)]">
                Регистрация занимает минуту — после входа можно сразу чертить, крутить 3D и
                выгружать смету.
              </p>
            </div>

            <Link
              href={activeUser ? "/editor" : "/register?next=%2Feditor"}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--mc-brand)] px-5 py-3 text-xs font-semibold text-[var(--mc-brand-text)] shadow-xs transition-colors hover:bg-[var(--mc-brand-light)]"
            >
              <span>{activeUser ? "Перейти в редактор" : "Открыть редактор"}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--mc-border)] bg-[var(--mc-bg-panel)] py-6 text-xs text-[var(--mc-text-subtle)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--mc-brand)] font-mono text-[10px] font-bold text-[var(--mc-brand-text)]">
                MC
              </span>
              <strong className="font-semibold text-[var(--mc-text)]">MetalCalc</strong>
              <span>· Проектирование металлоконструкций и смета</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Link href="/editor" className="transition-colors hover:text-[var(--mc-text)]">
              Редактор
            </Link>
            <Link href="/projects" className="transition-colors hover:text-[var(--mc-text)]">
              Проекты
            </Link>
            <Link href="/terms" className="transition-colors hover:text-[var(--mc-text)]">
              Соглашение
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-[var(--mc-text)]">
              Политика 152-ФЗ
            </Link>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("metalcalc:open-cookie-notice"))}
              className="transition-colors hover:text-[var(--mc-text)]"
            >
              О cookie
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
