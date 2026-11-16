"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { VerificationCodeStep } from "@/components/auth/VerificationCodeStep";
import { useAuthStore } from "@/store/useAuthStore";
import { useProjectStore } from "@/store/useProjectStore";
import type { AuthUser } from "@/types";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next")?.startsWith("/")
    ? searchParams.get("next")!
    : "/editor";
  const oauthError = searchParams.get("oauthError");

  const user = useAuthStore((s) => s.user);
  const oauthProviders = useAuthStore((s) => s.oauthProviders);
  const hydrateAuth = useAuthStore((s) => s.hydrateAuth);
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibleError = error ?? oauthError;

  const [pendingVerification, setPendingVerification] = useState<{
    email: string;
    cooldownSeconds: number;
    devPreviewCode?: string;
  } | null>(null);

  useEffect(() => {
    void hydrateAuth();
  }, [hydrateAuth]);

  useEffect(() => {
    if (user) {
      router.replace(nextPath);
    }
  }, [user, router, nextPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Введите email и пароль.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          rememberMe,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        user?: AuthUser;
        requiresVerification?: boolean;
        email?: string;
        cooldownSeconds?: number;
        devPreviewCode?: string;
      };

      if (res.status === 403 && data.requiresVerification && data.email) {
        setPendingVerification({
          email: data.email,
          cooldownSeconds: data.cooldownSeconds ?? 45,
          devPreviewCode: data.devPreviewCode,
        });
        return;
      }

      if (!res.ok || !data.user) {
        setError(data.error ?? "Не удалось войти в аккаунт.");
        return;
      }

      setUser(data.user);
      useProjectStore.getState().resetForUserSession();
      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Ошибка сети при попытке входа.");
    } finally {
      setSubmitting(false);
    }
  };

  if (pendingVerification) {
    return (
      <AuthShell
        title="Подтвердите электронную почту"
        subtitle="Аккаунт ещё не активирован — введите код из письма"
      >
        <VerificationCodeStep
          email={pendingVerification.email}
          initialCooldown={pendingVerification.cooldownSeconds}
          initialDevPreviewCode={pendingVerification.devPreviewCode}
          onVerified={(verifiedUser) => {
            setUser(verifiedUser);
            useProjectStore.getState().resetForUserSession();
            router.push(nextPath);
            router.refresh();
          }}
          onChangeEmail={() => setPendingVerification(null)}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Вход в MetalCalc"
      subtitle="Войдите, чтобы сохранять проекты и сметы в своём профиле"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {visibleError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-[var(--mc-danger-border)] bg-[var(--mc-danger-soft)] px-3 py-2.5 text-xs text-[var(--mc-danger-text)]"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{visibleError}</span>
          </div>
        )}

        <label className="block text-xs font-medium text-[var(--mc-text-secondary)]">
          Электронная почта
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="engineer@company.ru"
            className="mt-1.5 w-full rounded-lg border border-[var(--mc-border-strong)] bg-[var(--mc-bg-input)] px-3 py-2.5 text-xs text-[var(--mc-text)] placeholder-[var(--mc-text-subtle)] outline-none transition-colors focus:border-[var(--mc-brand-light)]"
          />
        </label>

        <label className="block text-xs font-medium text-[var(--mc-text-secondary)]">
          Пароль
          <div className="relative mt-1.5">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              className="w-full rounded-lg border border-[var(--mc-border-strong)] bg-[var(--mc-bg-input)] px-3 py-2.5 pr-10 text-xs text-[var(--mc-text)] placeholder-[var(--mc-text-subtle)] outline-none transition-colors focus:border-[var(--mc-brand-light)]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-[var(--mc-text-muted)] transition-colors hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
            >
              {showPassword ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--mc-text-secondary)]">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--mc-brand)]"
          />
          <span>Запомнить меня на этом устройстве</span>
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-[var(--mc-brand)] px-4 py-2.5 text-xs font-semibold text-[var(--mc-brand-text)] transition-colors hover:bg-[var(--mc-brand-light)] disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LogIn className="h-3.5 w-3.5" />
          )}
          <span>Войти</span>
        </button>
      </form>

      <OAuthButtons mode="login" oauthProviders={oauthProviders} nextPath={nextPath} />

      <p className="text-center text-xs text-[var(--mc-text-muted)]">
        Нет аккаунта?{" "}
        <Link
          href={
            nextPath !== "/editor"
              ? `/register?next=${encodeURIComponent(nextPath)}`
              : "/register"
          }
          className="font-semibold text-[var(--mc-brand-inline)] hover:underline"
        >
          Зарегистрироваться
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Вход в MetalCalc" subtitle="Загрузка формы авторизации...">
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--mc-brand-inline)]" />
          </div>
        </AuthShell>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
