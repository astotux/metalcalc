import { NextResponse } from "next/server";
import { getOAuthConfigStatus } from "@/lib/auth/oauth";
import { getSessionUserFromRequest } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = getSessionUserFromRequest(request);
    const oauthProviders = getOAuthConfigStatus();
    return NextResponse.json({ user, oauthProviders });
  } catch (error) {
    console.error("GET /api/auth/me error:", error);
    return NextResponse.json(
      { error: "Не удалось определить текущего пользователя." },
      { status: 500 }
    );
  }
}
