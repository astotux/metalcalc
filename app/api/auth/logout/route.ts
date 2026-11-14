import { NextResponse } from "next/server";
import { clearSessionCookie, revokeSessionFromRequest } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    revokeSessionFromRequest(request);
    const response = NextResponse.json({ ok: true });
    return clearSessionCookie(response);
  } catch (error) {
    console.error("POST /api/auth/logout error:", error);
    return NextResponse.json(
      { error: "Не удалось завершить сессию." },
      { status: 500 }
    );
  }
}
