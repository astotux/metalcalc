import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateSixDigitCode,
  sendVerificationCodeEmail,
} from "@/lib/auth/email";
import { verifyPassword } from "@/lib/auth/password";
import { attachSessionCookie, issueSessionForUser } from "@/lib/auth/session";
import {
  findUserByEmail,
  getVerificationResendCooldownSeconds,
  normalizeEmail,
  saveEmailVerificationCode,
} from "@/lib/db/usersRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().trim().email("Введите корректный email"),
  password: z.string().min(1, "Введите пароль"),
  rememberMe: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Заполните email и пароль." },
        { status: 400 }
      );
    }

    const email = normalizeEmail(parsed.data.email);
    const user = findUserByEmail(email);

    if (!user) {
      return NextResponse.json(
        { error: "Неверный email или пароль." },
        { status: 401 }
      );
    }

    if (!user.passwordHash) {
      const oauthNames = user.providers
        .map((p) => (p === "yandex" ? "Яндекс ID" : p))
        .join(" / ");
      return NextResponse.json(
        {
          error: `Этот аккаунт зарегистрирован через ${oauthNames || "внешний сервис"}. Используйте соответствующую кнопку входа ниже.`,
        },
        { status: 401 }
      );
    }

    const validPassword = verifyPassword(parsed.data.password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json(
        { error: "Неверный email или пароль." },
        { status: 401 }
      );
    }

    if (!user.emailVerified) {
      const cooldown = getVerificationResendCooldownSeconds(email);
      let devPreviewCode: string | undefined;
      let deliveredVia: "smtp" | "dev_preview" | undefined;

      if (cooldown === 0) {
        const code = generateSixDigitCode();
        saveEmailVerificationCode({ email, userId: user.id, code });
        const delivery = await sendVerificationCodeEmail({
          toEmail: email,
          name: user.name,
          code,
        });
        deliveredVia = delivery.deliveredVia;
        devPreviewCode = delivery.devPreviewCode;
      }

      return NextResponse.json(
        {
          error: "Почта ещё не подтверждена. Введите 6-значный код из письма.",
          requiresVerification: true,
          email,
          cooldownSeconds: cooldown || 45,
          ...(deliveredVia ? { deliveredVia } : {}),
          ...(devPreviewCode ? { devPreviewCode } : {}),
        },
        { status: 403 }
      );
    }

    const session = issueSessionForUser(user.id, parsed.data.rememberMe ?? true);
    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      providers: user.providers,
      createdAt: user.createdAt,
    };

    const response = NextResponse.json({ ok: true, user: safeUser });
    return attachSessionCookie(response, session);
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json(
      { error: "Не удалось выполнить вход." },
      { status: 500 }
    );
  }
}
