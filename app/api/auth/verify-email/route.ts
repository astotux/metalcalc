import { NextResponse } from "next/server";
import { z } from "zod";
import { attachSessionCookie, issueSessionForUser } from "@/lib/auth/session";
import { normalizeEmail, verifyEmailCodeInDb } from "@/lib/db/usersRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const verifySchema = z.object({
  email: z.string().trim().email("Некорректный email"),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Введите 6-значный цифровой код"),
  rememberMe: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Некорректный формат кода." },
        { status: 400 }
      );
    }

    const email = normalizeEmail(parsed.data.email);
    const result = verifyEmailCodeInDb(email, parsed.data.code);

    if (!result.ok) {
      if (result.reason === "expired") {
        return NextResponse.json(
          { error: "Срок действия кода истёк. Запросите новый код." },
          { status: 400 }
        );
      }
      if (result.reason === "too_many_attempts") {
        return NextResponse.json(
          { error: "Превышено число попыток. Запросите новый код подтверждения." },
          { status: 429 }
        );
      }
      if (result.reason === "invalid") {
        return NextResponse.json(
          {
            error: `Неверный код подтверждения. Осталось попыток: ${result.attemptsLeft ?? 0}.`,
            attemptsLeft: result.attemptsLeft,
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Активный код подтверждения не найден. Запросите новый код." },
        { status: 400 }
      );
    }

    const session = issueSessionForUser(result.user.id, parsed.data.rememberMe ?? true);
    const response = NextResponse.json({ ok: true, user: result.user });
    return attachSessionCookie(response, session);
  } catch (error) {
    console.error("POST /api/auth/verify-email error:", error);
    return NextResponse.json(
      { error: "Не удалось подтвердить электронную почту." },
      { status: 500 }
    );
  }
}
