"use client";

import type { OAuthProvidersStatus } from "@/types";

interface OAuthButtonsProps {
  mode: "login" | "register";
  oauthProviders?: OAuthProvidersStatus;
  nextPath?: string;
}

export function OAuthButtons({
  mode,
  oauthProviders,
  nextPath = "/editor",
}: OAuthButtonsProps) {
  const verb = mode === "register" ? "Регистрация через" : "Войти через";
  const fromParam = mode === "register" ? "register" : "login";
  const encodedNext = encodeURIComponent(nextPath);

  return (
    <div className="space-y-2.5">
      <div className="relative flex items-center py-1">
        <div className="flex-grow border-t border-[var(--mc-border)]" />
        <span className="mx-3 shrink-0 text-[11px] uppercase tracking-wider text-[var(--mc-text-subtle)]">
          или быстро через
        </span>
        <div className="flex-grow border-t border-[var(--mc-border)]" />
      </div>

      <a
        href={`/api/auth/oauth/yandex?from=${fromParam}&next=${encodedNext}`}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--mc-text)] transition-colors hover:bg-[var(--mc-bg-hover)]"
      >
        <span
          className="flex h-4 w-4 items-center justify-center rounded-full bg-[#FC3F1D] text-[10px] font-bold text-white"
          aria-hidden="true"
        >
          Я
        </span>
        <span>{verb} Яндекс</span>
      </a>
    </div>
  );
}
