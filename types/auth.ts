export type AuthProviderType = "email" | "yandex";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  emailVerified: boolean;
  providers: AuthProviderType[];
  createdAt: string;
}

export interface PasswordRuleResult {
  id: string;
  label: string;
  passed: boolean;
}

export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4;

export interface PasswordStrengthResult {
  score: PasswordStrengthScore;
  label: "Очень слабый" | "Слабый" | "Средний" | "Хороший" | "Надёжный";
  isAcceptable: boolean;
  rules: PasswordRuleResult[];
}

export interface OAuthProvidersStatus {
  yandex: boolean;
}
