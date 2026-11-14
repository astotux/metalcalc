"use client";

import { Moon, Sun } from "lucide-react";
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
    <div className="min-h-screen bg-[var(--mc-bg-app)] text-[var(--mc-text)] flex flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--mc-border)] bg-[var(--mc-bg-panel)] px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--mc-brand)] text-xs font-bold text-[var(--mc-brand-text)] shadow-xs">
            MC
          </div>
          <span className="text-sm font-semibold tracking-tight text-[var(--mc-text)]">
            MetalCalc
          </span>
        </div>

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
      </header>

      <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md space-y-5 rounded-xl border border-[var(--mc-border)] bg-[var(--mc-bg-panel)] p-6 shadow-sm">
          <div className="space-y-1.5 text-center">
            <h1 className="text-lg font-semibold tracking-tight text-[var(--mc-text)]">
              {title}
            </h1>
            <p className="text-xs text-[var(--mc-text-muted)]">{subtitle}</p>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
