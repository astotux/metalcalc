"use client";

import { Check, Circle } from "lucide-react";
import type { PasswordStrengthResult } from "@/types";

interface PasswordStrengthMeterProps {
  strength: PasswordStrengthResult;
  visible: boolean;
}

export function PasswordStrengthMeter({
  strength,
  visible,
}: PasswordStrengthMeterProps) {
  if (!visible) return null;

  const activeBarColor =
    strength.score <= 1
      ? "bg-[var(--mc-danger-text)]"
      : strength.score === 2
        ? "bg-[var(--mc-warning-text)]"
        : strength.score === 3
          ? "bg-[var(--mc-brand-light)]"
          : "bg-[var(--mc-success-text)]";

  const labelColor =
    strength.score <= 1
      ? "text-[var(--mc-danger-text)]"
      : strength.score === 2
        ? "text-[var(--mc-warning-text)]"
        : strength.score === 3
          ? "text-[var(--mc-brand-inline)]"
          : "text-[var(--mc-success-text)]";

  return (
    <div className="space-y-2 rounded-lg border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] p-3">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[var(--mc-text-muted)]">Сложность пароля</span>
        <span className={`font-medium ${labelColor}`}>{strength.label}</span>
      </div>

      <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((segment) => (
          <div
            key={segment}
            className={`h-1.5 rounded-full transition-colors ${
              strength.score >= segment ? activeBarColor : "bg-[var(--mc-border)]"
            }`}
          />
        ))}
      </div>

      <ul className="space-y-1 pt-0.5">
        {strength.rules.map((rule) => (
          <li
            key={rule.id}
            className={`flex items-center gap-1.5 text-[11px] transition-colors ${
              rule.passed
                ? "text-[var(--mc-success-text)]"
                : "text-[var(--mc-text-muted)]"
            }`}
          >
            {rule.passed ? (
              <Check className="h-3 w-3 shrink-0" />
            ) : (
              <Circle className="h-3 w-3 shrink-0 opacity-60" />
            )}
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
