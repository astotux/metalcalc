"use client";

import Link from "next/link";
import { ArrowLeft, FileCheck2, Moon, ShieldCheck, Sun } from "lucide-react";
import { useThemeStore } from "@/store/useThemeStore";

interface LegalPageShellProps {
  activeDoc: "privacy" | "terms";
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}

export function LegalPageShell({
  activeDoc,
  title,
  updatedAt,
  children,
}: LegalPageShellProps) {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className="min-h-screen bg-[var(--mc-bg-app)] text-[var(--mc-text)] flex flex-col">
      <header className="sticky top-0 z-20 border-b border-[var(--mc-border)] bg-[var(--mc-bg-panel)]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--mc-text-secondary)] transition-colors hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>На главную</span>
            </Link>
            <div className="hidden h-4 w-px bg-[var(--mc-border)] sm:block" />
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--mc-brand)] font-mono text-[10px] font-bold text-[var(--mc-brand-text)]">
                MC
              </div>
              <span className="text-sm font-semibold tracking-tight text-[var(--mc-text)]">
                MetalCalc
              </span>
            </Link>
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
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Link
            href="/terms"
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              activeDoc === "terms"
                ? "border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] text-[var(--mc-brand-inline)]"
                : "border-[var(--mc-border)] bg-[var(--mc-bg-panel)] text-[var(--mc-text-muted)] hover:text-[var(--mc-text)]"
            }`}
          >
            <FileCheck2 className="h-3.5 w-3.5" />
            Пользовательское соглашение
          </Link>
          <Link
            href="/privacy"
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              activeDoc === "privacy"
                ? "border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] text-[var(--mc-brand-inline)]"
                : "border-[var(--mc-border)] bg-[var(--mc-bg-panel)] text-[var(--mc-text-muted)] hover:text-[var(--mc-text)]"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Политика обработки персональных данных (152-ФЗ)
          </Link>
        </div>

        <article className="rounded-2xl border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-6 shadow-xs sm:p-8">
          <div className="border-b border-[var(--mc-border)] pb-5">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--mc-text)] sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 font-mono text-xs text-[var(--mc-text-muted)]">
              Редакция от {updatedAt}
            </p>
          </div>

          <div className="mt-6 space-y-6 text-sm leading-relaxed text-[var(--mc-text-secondary)]">
            {children}
          </div>
        </article>
      </main>

      <footer className="border-t border-[var(--mc-border)] bg-[var(--mc-bg-panel)] py-5 text-xs text-[var(--mc-text-subtle)]">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <span>MetalCalc · Правовая информация</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-[var(--mc-text)]">
              Главная
            </Link>
            <Link href="/terms" className="hover:text-[var(--mc-text)]">
              Соглашение
            </Link>
            <Link href="/privacy" className="hover:text-[var(--mc-text)]">
              Политика 152-ФЗ
            </Link>
            <Link href="/register" className="hover:text-[var(--mc-text)]">
              Регистрация
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
