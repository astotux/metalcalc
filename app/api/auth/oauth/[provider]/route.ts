import { NextResponse } from "next/server";
import {
  createOAuthAuthorizationRequest,
  isSupportedOAuthProvider,
  OAUTH_STATE_COOKIE_NAME,
  resolveRequestOrigin,
} from "@/lib/auth/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider } = await context.params;
  const origin = resolveRequestOrigin(request);
  const url = new URL(request.url);
  const returnToPage = url.searchParams.get("from") === "register" ? "/register" : "/login";
  const nextPath = url.searchParams.get("next") || "/editor";

  if (!isSupportedOAuthProvider(provider)) {
    const target = new URL(returnToPage, origin);
    target.searchParams.set("oauthError", "Неподдерживаемый способ авторизации.");
    return NextResponse.redirect(target);
  }

  try {
    const { authorizationUrl, stateCookieValue } = createOAuthAuthorizationRequest({
      provider,
      request,
      nextPath,
    });

    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set(OAUTH_STATE_COOKIE_NAME, stateCookieValue, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
    });
    return response;
  } catch (error) {
    const target = new URL(returnToPage, origin);
    target.searchParams.set(
      "oauthError",
      error instanceof Error ? error.message : "OAuth-авторизация временно недоступна."
    );
    return NextResponse.redirect(target);
  }
}
