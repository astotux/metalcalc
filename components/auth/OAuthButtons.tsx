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

  const anyMissing =
    oauthProviders !== undefined &&
    (!oauthProviders.yandex || !oauthProviders.vk);

  return (
    <div className="space-y-2.5">
      <div className="relative flex items-center py-1">
        <div className="flex-grow border-t border-[var(--mc-border)]" />
        <span className="mx-3 shrink-0 text-[11px] uppercase tracking-wider text-[var(--mc-text-subtle)]">
          или быстро через
        </span>
        <div className="flex-grow border-t border-[var(--mc-border)]" />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <a
          href={`/api/auth/oauth/yandex?from=${fromParam}&next=${encodedNext}`}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--mc-text)] transition-colors hover:bg-[var(--mc-bg-hover)]"
        >
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full bg-[#FC3F1D] text-[10px] font-bold text-white"
            aria-hidden="true"
          >
            Я
          </span>
          <span>{verb} Яндекс</span>
        </a>

        <a
          href={`/api/auth/oauth/vk?from=${fromParam}&next=${encodedNext}`}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-3 py-2 text-xs font-medium text-[var(--mc-text)] transition-colors hover:bg-[var(--mc-bg-hover)]"
        >
          <span
            className="flex h-4 w-4 items-center justify-center rounded bg-[#0077FF] text-[9px] font-bold text-white"
            aria-hidden="true"
          >
            VK
          </span>
          <span>{verb} VK</span>
        </a>
      </div>

      {anyMissing && (
        <p className="text-center text-[11px] text-[var(--mc-text-subtle)]">
          Для работы OAuth на локальном сервере задайте ключи в{" "}
          <code className="rounded bg-[var(--mc-bg-elevated)] px-1 py-0.5 text-[10px]">
            .env.local
          </code>
          .
        </p>
      )}
    </div>
  );
}
