"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Cookie, X } from "lucide-react";

const COOKIE_NOTICE_KEY = "metalcalc_cookie_notice_v1";
const COOKIE_CHANGE_EVENT = "metalcalc:cookie-notice-changed";

function subscribeCookieNotice(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(COOKIE_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(COOKIE_CHANGE_EVENT, onStoreChange);
  };
}

function getCookieNoticeSnapshot(): boolean {
  try {
    return Boolean(window.localStorage.getItem(COOKIE_NOTICE_KEY));
  } catch {
    return false;
  }
}

function getCookieNoticeServerSnapshot(): boolean {
  return true;
}

export function CookieBanner() {
  const acknowledged = useSyncExternalStore(
    subscribeCookieNotice,
    getCookieNoticeSnapshot,
    getCookieNoticeServerSnapshot
  );
  const [forceOpen, setForceOpen] = useState(false);

  useEffect(() => {
    const handleReopen = () => setForceOpen(true);
    window.addEventListener("metalcalc:open-cookie-notice", handleReopen);
    return () => window.removeEventListener("metalcalc:open-cookie-notice", handleReopen);
  }, []);

  const accept = () => {
    try {
      window.localStorage.setItem(COOKIE_NOTICE_KEY, new Date().toISOString());
    } catch {
      // ignore storage errors
    }
    setForceOpen(false);
    window.dispatchEvent(new CustomEvent(COOKIE_CHANGE_EVENT));
  };

  if (acknowledged && !forceOpen) return null;

  return (
    <aside
      role="region"
      aria-label="Уведомление об использовании cookie"
      className="fixed right-3 bottom-3 left-3 z-50 mx-auto max-w-lg rounded-xl border border-[var(--mc-border-strong)] bg-[var(--mc-bg-panel)]/95 p-4 shadow-2xl backdrop-blur-md sm:right-4 sm:bottom-4 sm:left-auto"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] text-[var(--mc-brand-inline)]">
          <Cookie className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xs font-semibold text-[var(--mc-text)]">
              Мы используем файлы cookie
            </h2>
            <button
              type="button"
              onClick={accept}
              aria-label="Закрыть уведомление о cookie"
              className="rounded p-1 text-[var(--mc-text-muted)] transition-colors hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="text-[11px] leading-relaxed text-[var(--mc-text-muted)]">
            Файлы cookie нужны для работы сервиса (авторизация, сохранение настроек интерфейса) и
            для веб-аналитики, чтобы понимать, как развивать программу. Подробнее — в{" "}
            <Link href="/privacy" className="font-medium text-[var(--mc-brand-inline)] hover:underline">
              Политике конфиденциальности
            </Link>
            .
          </p>

          <div className="flex justify-end pt-0.5">
            <button
              type="button"
              onClick={accept}
              className="rounded-md bg-[var(--mc-brand)] px-3.5 py-1.5 text-[11px] font-semibold text-[var(--mc-brand-text)] transition-colors hover:bg-[var(--mc-brand-light)]"
            >
              Понятно
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
