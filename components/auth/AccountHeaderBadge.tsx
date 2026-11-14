"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useProjectStore } from "@/store/useProjectStore";

export function AccountHeaderBadge() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const hydrateAuth = useAuthStore((s) => s.hydrateAuth);
  const logout = useAuthStore((s) => s.logout);
  const resetForUserSession = useProjectStore((s) => s.resetForUserSession);

  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    void hydrateAuth();
  }, [hydrateAuth]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      resetForUserSession();
      const pathname = typeof window !== "undefined" ? window.location.pathname : "";
      if (pathname === "/") {
        router.refresh();
      } else {
        router.replace("/login");
        router.refresh();
      }
    } finally {
      setLoggingOut(false);
    }
  };

  if (!initialized) {
    return (
      <div className="h-7 w-16 rounded border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] opacity-50" />
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 rounded border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--mc-text)] transition-colors hover:bg-[var(--mc-bg-hover)]"
        title="Войти или зарегистрироваться"
      >
        <LogIn className="h-3.5 w-3.5 text-[var(--mc-brand-inline)]" />
        <span>Войти</span>
      </Link>
    );
  }

  const initial = (user.name || user.email || "U").trim().charAt(0).toUpperCase();

  return (
    <div className="inline-flex items-center gap-1 rounded border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] pl-1.5 pr-1 py-0.5 text-xs">
      <div
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--mc-brand)] text-[10px] font-semibold text-[var(--mc-brand-text)]"
        title={`${user.name} (${user.email})`}
      >
        {initial}
      </div>
      <span
        className="hidden max-w-[96px] truncate text-[var(--mc-text)] xl:inline"
        title={`${user.name} — ${user.email}`}
      >
        {user.name}
      </span>
      <button
        type="button"
        onClick={() => void handleLogout()}
        disabled={loggingOut}
        title="Выйти из аккаунта"
        aria-label="Выйти из аккаунта"
        className="rounded p-1 text-[var(--mc-text-muted)] transition-colors hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-danger-text)] disabled:opacity-50"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
