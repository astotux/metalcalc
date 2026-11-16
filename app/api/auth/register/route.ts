import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateSixDigitCode,
  sendVerificationCodeEmail,
} from "@/lib/auth/email";
import { hashPassword } from "@/lib/auth/password";
import { evaluatePasswordStrength } from "@/lib/auth/passwordStrength";
import {
  getVerificationResendCooldownSeconds,
  normalizeEmail,
  saveEmailVerificationCode,
  upsertPendingEmailUser,
} from "@/lib/db/usersRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Укажите имя (не менее 2 символов)")
    .max(80, "Имя слишком длинное"),
  email: z.string().trim().email("Введите корректный email"),
  password: z.string().min(8, "Пароль должен содержать не менее 8 символов").max(128),
  acceptedTerms: z.boolean().optional(),
  acceptedPrivacy: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Некорректные данные регистрации." },
        { status: 400 }
      );
    }

    if (parsed.data.acceptedTerms === false || parsed.data.acceptedPrivacy === false) {
      return NextResponse.json(
        {
          error:
            "Для регистрации необходимо принять пользовательское соглашение и дать согласие на обработку персональных данных.",
        },
        { status: 400 }
      );
    }

    const email = normalizeEmail(parsed.data.email);
    const strength = evaluatePasswordStrength(parsed.data.password);
    if (!strength.isAcceptable) {
      const failedRule = strength.rules.find((r) => !r.passed);
      return NextResponse.json(
        {
          error: failedRule
            ? `Пароль слишком простой: ${failedRule.label.toLowerCase()}.`
            : "Пароль не соответствует требованиям безопасности.",
          passwordStrength: strength,
        },
        { status: 400 }
      );
    }

    const passwordHash = hashPassword(parsed.data.password);
    const { user, alreadyVerified } = upsertPendingEmailUser({
      email,
      name: parsed.data.name,
      passwordHash,
    });

    if (alreadyVerified) {
      return NextResponse.json(
        { error: "Аккаунт с этим email уже зарегистрирован. Войдите в систему." },
        { status: 409 }
      );
    }

    const cooldown = getVerificationResendCooldownSeconds(email);
    if (cooldown > 0) {
      return NextResponse.json(
        {
          error: `Код уже был отправлен. Повторная отправка возможна через ${cooldown} сек.`,
          requiresVerification: true,
          email,
          cooldownSeconds: cooldown,
        },
        { status: 429 }
      );
    }

    const code = generateSixDigitCode();
    saveEmailVerificationCode({
      email,
      userId: user.id,
      code,
    });

    const delivery = await sendVerificationCodeEmail({
      toEmail: email,
      name: user.name,
      code,
    });

    return NextResponse.json(
      {
        ok: true,
        requiresVerification: true,
        email,
        cooldownSeconds: 45,
        deliveredVia: delivery.deliveredVia,
        ...(delivery.devPreviewCode ? { devPreviewCode: delivery.devPreviewCode } : {}),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/auth/register error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось завершить регистрацию.",
      },
      { status: 500 }
    );
  }
}
