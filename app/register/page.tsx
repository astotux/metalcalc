"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { VerificationCodeStep } from "@/components/auth/VerificationCodeStep";
import { evaluatePasswordStrength } from "@/lib/auth/passwordStrength";
import { useAuthStore } from "@/store/useAuthStore";
import { useProjectStore } from "@/store/useProjectStore";

function RegisterFormContent() {
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

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibleError = error ?? oauthError;

  const [verificationStep, setVerificationStep] = useState<{
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

  const strength = useMemo(() => evaluatePasswordStrength(password), [password]);
  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError("Укажите имя (минимум 2 символа).");
      return;
    }

    if (!strength.isAcceptable) {
      setError("Усильте пароль — выполните все требования из списка ниже.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Пароль и подтверждение пароля не совпадают.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        requiresVerification?: boolean;
        email?: string;
        cooldownSeconds?: number;
        devPreviewCode?: string;
      };

      if (res.status === 429 && data.requiresVerification && data.email) {
        setVerificationStep({
          email: data.email,
          cooldownSeconds: data.cooldownSeconds ?? 45,
        });
        return;
      }

      if (!res.ok || !data.requiresVerification) {
        setError(data.error ?? "Не удалось зарегистрироваться.");
        return;
      }

      setVerificationStep({
        email: data.email ?? email.trim().toLowerCase(),
        cooldownSeconds: data.cooldownSeconds ?? 45,
        devPreviewCode: data.devPreviewCode,
      });
    } catch {
      setError("Ошибка сети при регистрации.");
    } finally {
      setSubmitting(false);
    }
  };

  if (verificationStep) {
    return (
      <AuthShell
        title="Подтверждение почты"
        subtitle="Шаг 2 из 2 — введите 6-значный код из письма"
      >
        <VerificationCodeStep
          email={verificationStep.email}
          initialCooldown={verificationStep.cooldownSeconds}
          initialDevPreviewCode={verificationStep.devPreviewCode}
          onVerified={(verifiedUser) => {
            setUser(verifiedUser);
            useProjectStore.getState().resetForUserSession();
            router.push(nextPath);
            router.refresh();
          }}
          onChangeEmail={() => setVerificationStep(null)}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Регистрация в MetalCalc"
      subtitle="Создайте аккаунт по email с кодом подтверждения"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
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
          Имя или название компании
          <input
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Иван Иванов"
            className="mt-1.5 w-full rounded-lg border border-[var(--mc-border-strong)] bg-[var(--mc-bg-input)] px-3 py-2.5 text-xs text-[var(--mc-text)] placeholder-[var(--mc-text-subtle)] outline-none transition-colors focus:border-[var(--mc-brand-light)]"
          />
        </label>

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
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Придумайте надёжный пароль"
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

        <PasswordStrengthMeter strength={strength} visible={password.length > 0} />

        <label className="block text-xs font-medium text-[var(--mc-text-secondary)]">
          Повторите пароль
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Повторите пароль"
            className={`mt-1.5 w-full rounded-lg border bg-[var(--mc-bg-input)] px-3 py-2.5 text-xs text-[var(--mc-text)] placeholder-[var(--mc-text-subtle)] outline-none transition-colors ${
              passwordsMatch
                ? "border-[var(--mc-border-strong)] focus:border-[var(--mc-brand-light)]"
                : "border-[var(--mc-danger-border)]"
            }`}
          />
          {!passwordsMatch && (
            <span className="mt-1 block text-[11px] text-[var(--mc-danger-text)]">
              Пароли не совпадают
            </span>
          )}
        </label>

        <button
          type="submit"
          disabled={submitting || !strength.isAcceptable || password !== confirmPassword}
          className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-[var(--mc-brand)] px-4 py-2.5 text-xs font-semibold text-[var(--mc-brand-text)] transition-colors hover:bg-[var(--mc-brand-light)] disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <UserPlus className="h-3.5 w-3.5" />
          )}
          <span>Получить код подтверждения</span>
        </button>
      </form>

      <OAuthButtons mode="register" oauthProviders={oauthProviders} nextPath={nextPath} />

      <p className="text-center text-xs text-[var(--mc-text-muted)]">
        Уже есть аккаунт?{" "}
        <Link
          href={
            nextPath !== "/editor" ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"
          }
          className="font-semibold text-[var(--mc-brand-inline)] hover:underline"
        >
          Войти
        </Link>
      </p>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Регистрация в MetalCalc" subtitle="Загрузка формы регистрации...">
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--mc-brand-inline)]" />
          </div>
        </AuthShell>
      }
    >
      <RegisterFormContent />
    </Suspense>
  );
}
