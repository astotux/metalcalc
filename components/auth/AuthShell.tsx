"use client";

import Link from "next/link";
import { ArrowLeft, Box, Calculator, Layers, Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/store/useThemeStore";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[var(--mc-bg-app)] text-[var(--mc-text)]">
      <div
        aria-hidden="true"
        className="mc-blueprint-grid pointer-events-none fixed inset-0 opacity-25 [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_80%)]"
      />

      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-[var(--mc-border)] bg-[var(--mc-bg-panel)]/90 px-4 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--mc-text-secondary)] transition-colors hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>На главную</span>
          </Link>
          <div className="h-4 w-px bg-[var(--mc-border)]" />
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--mc-brand)] font-mono text-xs font-bold text-[var(--mc-brand-text)] shadow-xs">
              MC
            </div>
            <span className="text-sm font-semibold tracking-tight text-[var(--mc-text)]">
              MetalCalc
            </span>
          </Link>
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
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--mc-border-strong)] bg-[var(--mc-bg-panel)] shadow-2xl lg:grid-cols-12">
          {/* Левая инженерная панель-справка на десктопе */}
          <aside className="hidden flex-col justify-between border-r border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] p-7 lg:col-span-5 lg:flex">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--mc-brand-inline)]">
                Рабочее пространство САПР
              </div>
              <h2 className="text-xl font-bold leading-snug tracking-tight text-[var(--mc-text)]">
                Проектируйте металлоконструкции и сметы в одном окне
              </h2>
              <p className="text-xs leading-relaxed text-[var(--mc-text-muted)]">
                Ваши проекты, пользовательские профили труб и тарифы хранятся в изолированной
                персональной базе.
              </p>
            </div>

            <div className="space-y-3 pt-6">
              <div className="flex items-start gap-2.5 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-3">
                <Layers className="mt-0.5 h-4 w-4 shrink-0 text-[var(--mc-brand-inline)]" />
                <div>
                  <div className="text-xs font-medium text-[var(--mc-text)]">3 ортогональных вида</div>
                  <div className="text-[11px] text-[var(--mc-text-muted)]">XY, XZ, YZ с привязками до 1 мм</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-3">
                <Box className="mt-0.5 h-4 w-4 shrink-0 text-[var(--mc-brand-inline)]" />
                <div>
                  <div className="text-xs font-medium text-[var(--mc-text)]">3D-визуализация узлов</div>
                  <div className="text-[11px] text-[var(--mc-text-muted)]">Подрезка торцов и 3D-манипулятор</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-3">
                <Calculator className="mt-0.5 h-4 w-4 shrink-0 text-[var(--mc-brand-inline)]" />
                <div>
                  <div className="text-xs font-medium text-[var(--mc-text)]">Спецификация PDF / XLSX</div>
                  <div className="text-[11px] text-[var(--mc-text-muted)]">Автоподсчёт металла, швов и покраски</div>
                </div>
              </div>
            </div>
          </aside>

          {/* Правая панель: форма */}
          <div className="p-6 sm:p-8 lg:col-span-7">
            <div className="mx-auto w-full max-w-md space-y-5">
              <div className="space-y-1.5">
                <h1 className="text-xl font-bold tracking-tight text-[var(--mc-text)]">
                  {title}
                </h1>
                <p className="text-xs leading-relaxed text-[var(--mc-text-muted)]">{subtitle}</p>
              </div>

              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
