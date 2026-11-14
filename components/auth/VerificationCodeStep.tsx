"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Mail, RefreshCw } from "lucide-react";
import type { AuthUser } from "@/types";

interface VerificationCodeStepProps {
  email: string;
  initialCooldown?: number;
  initialDevPreviewCode?: string;
  onVerified: (user: AuthUser) => void;
  onChangeEmail?: () => void;
}

export function VerificationCodeStep({
  email,
  initialCooldown = 45,
  initialDevPreviewCode,
  onVerified,
  onChangeEmail,
}: VerificationCodeStepProps) {
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(initialCooldown);
  const [overridePreviewCode, setOverridePreviewCode] = useState<string | undefined>(
    undefined
  );
  const devPreviewCode = overridePreviewCode ?? initialDevPreviewCode;
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const cleaned = code.replace(/\D/g, "").slice(0, 6);
    if (cleaned.length !== 6) {
      setError("Введите 6-значный цифровой код из письма.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: cleaned, rememberMe: true }),
      });
      const data = (await res.json()) as {
        error?: string;
        user?: AuthUser;
      };
      if (!res.ok || !data.user) {
        setError(data.error ?? "Не удалось проверить код.");
        return;
      }
      onVerified(data.user);
    } catch {
      setError("Ошибка сети при проверке кода.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setError(null);
    setInfoMessage(null);
    setResending(true);

    try {
      const res = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as {
        error?: string;
        cooldownSeconds?: number;
        devPreviewCode?: string;
      };
      if (!res.ok) {
        if (data.cooldownSeconds) {
          setCooldown(data.cooldownSeconds);
        }
        setError(data.error ?? "Не удалось отправить код повторно.");
        return;
      }
      setCooldown(data.cooldownSeconds ?? 45);
      if (data.devPreviewCode) {
        setOverridePreviewCode(data.devPreviewCode);
      }
      setInfoMessage("Новый 6-значный код отправлен.");
    } catch {
      setError("Ошибка сети при повторной отправке кода.");
    } finally {
      setResending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] p-3 text-xs">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[var(--mc-brand-inline)]" />
        <div className="space-y-1">
          <p className="font-medium text-[var(--mc-text)]">
            Код отправлен на {email}
          </p>
          <p className="text-[11px] text-[var(--mc-text-muted)]">
            Введите 6-значный код подтверждения. Код действует 10 минут. Не забудьтепроверить вкладку "Спам"
          </p>
        </div>
      </div>

      {devPreviewCode && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] px-3 py-2 text-xs text-[var(--mc-text)]">
          <div>
            <span className="text-[11px] text-[var(--mc-text-muted)]">
              SMTP не настроен (dev-режим). Код:{" "}
            </span>
            <strong className="font-mono tracking-widest text-[var(--mc-brand-inline)]">
              {devPreviewCode}
            </strong>
          </div>
          <button
            type="button"
            onClick={() => setCode(devPreviewCode)}
            className="rounded border border-[var(--mc-brand-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--mc-brand-inline)] hover:bg-[var(--mc-bg-hover)]"
          >
            Вставить
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--mc-danger-border)] bg-[var(--mc-danger-soft)] px-3 py-2 text-xs text-[var(--mc-danger-text)]">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {infoMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-3 py-2 text-xs text-[var(--mc-success-text)]">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{infoMessage}</span>
        </div>
      )}

      <label className="block text-xs text-[var(--mc-text-muted)]">
        Код подтверждения из письма
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          autoFocus
          className="mt-1.5 w-full rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-input)] px-3 py-2.5 text-center font-mono text-lg font-semibold tracking-[0.45em] text-[var(--mc-text)] outline-none focus:border-[var(--mc-brand-border)]"
        />
      </label>

      <button
        type="submit"
        disabled={submitting || code.length !== 6}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--mc-brand)] px-4 py-2.5 text-xs font-medium text-[var(--mc-brand-text)] transition-colors hover:bg-[var(--mc-brand-light)] disabled:opacity-60"
      >
        {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        <span>Подтвердить почту и войти</span>
      </button>

      <div className="flex items-center justify-between text-[11px]">
        <button
          type="button"
          onClick={() => void handleResend()}
          disabled={cooldown > 0 || resending}
          className="inline-flex items-center gap-1 text-[var(--mc-text-secondary)] hover:text-[var(--mc-text)] disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${resending ? "animate-spin" : ""}`} />
          {cooldown > 0
            ? `Отправить повторно (${cooldown} сек.)`
            : "Отправить код повторно"}
        </button>

        {onChangeEmail && (
          <button
            type="button"
            onClick={onChangeEmail}
            className="text-[var(--mc-text-muted)] underline-offset-2 hover:text-[var(--mc-text)] hover:underline"
          >
            Изменить email
          </button>
        )}
      </div>
    </form>
  );
}
