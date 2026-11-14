import type { PasswordRuleResult, PasswordStrengthResult, PasswordStrengthScore } from "@/types";

const WEAK_COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password123",
  "qwerty123",
  "qwertyuiop",
  "admin123",
  "metalcalc",
]);

/**
 * Оценивает сложность пароля на клиенте и на сервере по единому набору правил.
 */
export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const normalized = password.trim().toLowerCase();

  const rules: PasswordRuleResult[] = [
    {
      id: "minLength",
      label: "Не менее 8 символов",
      passed: password.length >= 8,
    },
    {
      id: "uppercase",
      label: "Минимум 1 заглавная буква (A-Z / А-Я)",
      passed: /[A-ZА-ЯЁ]/.test(password),
    },
    {
      id: "lowercase",
      label: "Минимум 1 строчная буква (a-z / а-я)",
      passed: /[a-zа-яё]/.test(password),
    },
    {
      id: "digit",
      label: "Минимум 1 цифра (0-9)",
      passed: /\d/.test(password),
    },
    {
      id: "special",
      label: "Спецсимвол (!@#$%^&* и др.)",
      passed: /[^A-Za-zА-Яа-яЁё0-9\s]/.test(password),
    },
    {
      id: "noSpaces",
      label: "Без пробелов и шаблонных комбинаций",
      passed:
        password.length > 0 &&
        !/\s/.test(password) &&
        !WEAK_COMMON_PASSWORDS.has(normalized),
    },
  ];

  const requiredIds = new Set([
    "minLength",
    "uppercase",
    "lowercase",
    "digit",
    "special",
    "noSpaces",
  ]);
  const allRequiredPassed = rules
    .filter((r) => requiredIds.has(r.id))
    .every((r) => r.passed);

  const passedCount = rules.filter((r) => r.passed).length;
  const bonusLong = password.length >= 12 ? 1 : 0;

  let score: PasswordStrengthScore = 0;
  if (password.length === 0) {
    score = 0;
  } else if (passedCount <= 2) {
    score = 1;
  } else if (passedCount <= 4) {
    score = 2;
  } else if (passedCount < rules.length || bonusLong === 0) {
    score = allRequiredPassed ? 3 : 2;
  } else {
    score = 4;
  }

  if (allRequiredPassed && password.length >= 10) {
    score = 4;
  }

  const labelMap: Record<PasswordStrengthScore, PasswordStrengthResult["label"]> = {
    0: "Очень слабый",
    1: "Слабый",
    2: "Средний",
    3: "Хороший",
    4: "Надёжный",
  };

  return {
    score,
    label: labelMap[score],
    isAcceptable: allRequiredPassed,
    rules,
  };
}
