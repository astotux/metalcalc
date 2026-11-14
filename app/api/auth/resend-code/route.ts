import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateSixDigitCode,
  sendVerificationCodeEmail,
} from "@/lib/auth/email";
import {
  findUserByEmail,
  getVerificationResendCooldownSeconds,
  normalizeEmail,
  saveEmailVerificationCode,
} from "@/lib/db/usersRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resendSchema = z.object({
  email: z.string().trim().email("Введите корректный email"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = resendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Некорректный email." },
        { status: 400 }
      );
    }

    const email = normalizeEmail(parsed.data.email);
    const user = findUserByEmail(email);

    if (!user) {
      return NextResponse.json(
        { error: "Пользователь с таким email не найден. Сначала зарегистрируйтесь." },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: "Почта уже подтверждена. Вы можете войти в аккаунт." },
        { status: 400 }
      );
    }

    const cooldown = getVerificationResendCooldownSeconds(email);
    if (cooldown > 0) {
      return NextResponse.json(
        {
          error: `Подождите ${cooldown} сек. перед повторной отправкой кода.`,
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

    return NextResponse.json({
      ok: true,
      email,
      cooldownSeconds: 45,
      deliveredVia: delivery.deliveredVia,
      ...(delivery.devPreviewCode ? { devPreviewCode: delivery.devPreviewCode } : {}),
    });
  } catch (error) {
    console.error("POST /api/auth/resend-code error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Не удалось повторно отправить код.",
      },
      { status: 500 }
    );
  }
}
