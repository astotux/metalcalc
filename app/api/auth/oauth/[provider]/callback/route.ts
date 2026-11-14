import { NextResponse } from "next/server";
import {
  exchangeOAuthCodeForProfile,
  isSupportedOAuthProvider,
  OAUTH_STATE_COOKIE_NAME,
  resolveRequestOrigin,
  verifyOAuthStateToken,
} from "@/lib/auth/oauth";
import {
  attachSessionCookie,
  issueSessionForUser,
  parseCookieHeader,
} from "@/lib/auth/session";
import { upsertOAuthUser } from "@/lib/db/usersRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectWithOAuthError(origin: string, message: string): NextResponse {
  const target = new URL("/login", origin);
  target.searchParams.set("oauthError", message);
  const response = NextResponse.redirect(target);
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider } = await context.params;
  const origin = resolveRequestOrigin(request);
  const url = new URL(request.url);

  if (!isSupportedOAuthProvider(provider)) {
    return redirectWithOAuthError(origin, "Неизвестный OAuth-провайдер.");
  }

  const providerError =
    url.searchParams.get("error_description") || url.searchParams.get("error");
  if (providerError) {
    return redirectWithOAuthError(origin, `Авторизация отменена: ${providerError}`);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const deviceId = url.searchParams.get("device_id");

  if (!code || !state) {
    return redirectWithOAuthError(origin, "Провайдер не передал код авторизации.");
  }

  const cookiesMap = parseCookieHeader(request.headers.get("cookie"));
  const statePayload = verifyOAuthStateToken(cookiesMap[OAUTH_STATE_COOKIE_NAME]);

  if (!statePayload || statePayload.provider !== provider || statePayload.state !== state) {
    return redirectWithOAuthError(
      origin,
      "Сессия OAuth устарела или не прошла проверку безопасности. Попробуйте снова."
    );
  }

  try {
    const profile = await exchangeOAuthCodeForProfile({
      provider,
      code,
      statePayload,
      request,
      deviceId,
    });

    const user = upsertOAuthUser(profile);
    const session = issueSessionForUser(user.id, true);

    const destination = new URL(statePayload.nextPath || "/editor", origin);
    const response = NextResponse.redirect(destination);
    response.cookies.set(OAUTH_STATE_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return attachSessionCookie(response, session);
  } catch (error) {
    console.error(`GET /api/auth/oauth/${provider}/callback error:`, error);
    return redirectWithOAuthError(
      origin,
      error instanceof Error ? error.message : "Не удалось завершить вход через OAuth."
    );
  }
}
