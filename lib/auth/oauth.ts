import crypto from "node:crypto";
import { getAuthSecret } from "@/lib/auth/password";
import type { OAuthProvidersStatus } from "@/types";

export type OAuthProviderId = "yandex" | "vk";

export const OAUTH_STATE_COOKIE_NAME = "mc_oauth_state";

export interface OAuthStatePayload {
  provider: OAuthProviderId;
  state: string;
  codeVerifier: string;
  nextPath: string;
  exp: number;
}

export interface OAuthUserProfile {
  provider: OAuthProviderId;
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  name: string;
  avatarUrl?: string;
}

export function getOAuthConfigStatus(): OAuthProvidersStatus {
  return {
    yandex: Boolean(
      process.env.YANDEX_CLIENT_ID?.trim() &&
        process.env.YANDEX_CLIENT_SECRET?.trim()
    ),
    vk: Boolean(process.env.VK_CLIENT_ID?.trim()),
  };
}

export function isSupportedOAuthProvider(value: string): value is OAuthProviderId {
  return value === "yandex" || value === "vk";
}

export function resolveRequestOrigin(request: Request): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return url.origin;
}

export function getOAuthRedirectUri(
  provider: OAuthProviderId,
  request: Request
): string {
  return `${resolveRequestOrigin(request)}/api/auth/oauth/${provider}/callback`;
}

export function signOAuthStatePayload(payload: OAuthStatePayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getAuthSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyOAuthStateToken(token: string | undefined): OAuthStatePayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac("sha256", getAuthSecret())
    .update(encoded)
    .digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as OAuthStatePayload;
    if (!payload.exp || Date.now() > payload.exp) return null;
    if (!isSupportedOAuthProvider(payload.provider)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createOAuthAuthorizationRequest(params: {
  provider: OAuthProviderId;
  request: Request;
  nextPath?: string;
}): {
  authorizationUrl: string;
  stateCookieValue: string;
} {
  const { provider, request, nextPath = "/editor" } = params;
  const state = crypto.randomBytes(24).toString("base64url");
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  const safeNext = nextPath.startsWith("/") ? nextPath : "/editor";
  const payload: OAuthStatePayload = {
    provider,
    state,
    codeVerifier,
    nextPath: safeNext,
    exp: Date.now() + 1000 * 60 * 10, // 10 минут
  };

  const redirectUri = getOAuthRedirectUri(provider, request);

  if (provider === "yandex") {
    const clientId = process.env.YANDEX_CLIENT_ID?.trim();
    const clientSecret = process.env.YANDEX_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      throw new Error(
        "OAuth Яндекса не настроен: укажите YANDEX_CLIENT_ID и YANDEX_CLIENT_SECRET в .env.local."
      );
    }

    const authUrl = new URL("https://oauth.yandex.ru/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", "login:email login:info login:avatar");

    return {
      authorizationUrl: authUrl.toString(),
      stateCookieValue: signOAuthStatePayload(payload),
    };
  }

  const vkClientId = process.env.VK_CLIENT_ID?.trim();
  if (!vkClientId) {
    throw new Error(
      "OAuth VK ID не настроен: укажите VK_CLIENT_ID (и VK_CLIENT_SECRET при необходимости) в .env.local."
    );
  }

  const vkAuthUrl = new URL("https://id.vk.com/authorize");
  vkAuthUrl.searchParams.set("response_type", "code");
  vkAuthUrl.searchParams.set("client_id", vkClientId);
  vkAuthUrl.searchParams.set("redirect_uri", redirectUri);
  vkAuthUrl.searchParams.set("state", state);
  vkAuthUrl.searchParams.set("code_challenge", codeChallenge);
  vkAuthUrl.searchParams.set("code_challenge_method", "S256");
  vkAuthUrl.searchParams.set("scope", "email");

  return {
    authorizationUrl: vkAuthUrl.toString(),
    stateCookieValue: signOAuthStatePayload(payload),
  };
}

export async function exchangeOAuthCodeForProfile(params: {
  provider: OAuthProviderId;
  code: string;
  statePayload: OAuthStatePayload;
  request: Request;
  deviceId?: string | null;
}): Promise<OAuthUserProfile> {
  const { provider, code, statePayload, request, deviceId } = params;
  const redirectUri = getOAuthRedirectUri(provider, request);

  if (provider === "yandex") {
    const clientId = process.env.YANDEX_CLIENT_ID?.trim() || "";
    const clientSecret = process.env.YANDEX_CLIENT_SECRET?.trim() || "";

    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    const tokenResp = await fetch("https://oauth.yandex.ru/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    });
    const tokenJson = (await tokenResp.json()) as {
      access_token?: string;
      error_description?: string;
      error?: string;
    };

    if (!tokenResp.ok || !tokenJson.access_token) {
      throw new Error(
        tokenJson.error_description || tokenJson.error || "Не удалось получить токен Яндекса."
      );
    }

    const userResp = await fetch("https://login.yandex.ru/info?format=json", {
      headers: {
        Authorization: `OAuth ${tokenJson.access_token}`,
      },
    });
    const userJson = (await userResp.json()) as {
      id?: string;
      default_email?: string;
      emails?: string[];
      display_name?: string;
      real_name?: string;
      login?: string;
      default_avatar_id?: string;
      is_avatar_empty?: boolean;
    };

    if (!userResp.ok || !userJson.id) {
      throw new Error("Не удалось загрузить профиль пользователя Яндекса.");
    }

    const email = userJson.default_email || userJson.emails?.[0] || null;
    const name =
      userJson.display_name || userJson.real_name || userJson.login || "Пользователь Яндекс";
    const avatarUrl =
      userJson.default_avatar_id && !userJson.is_avatar_empty
        ? `https://avatars.yandex.net/get-yapic/${userJson.default_avatar_id}/islands-200`
        : undefined;

    return {
      provider: "yandex",
      providerUserId: String(userJson.id),
      email: email ? email.trim().toLowerCase() : null,
      emailVerified: Boolean(email),
      name,
      avatarUrl,
    };
  }

  // VK ID OAuth 2.1 (PKCE)
  const vkClientId = process.env.VK_CLIENT_ID?.trim() || "";
  const vkClientSecret = process.env.VK_CLIENT_SECRET?.trim();

  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: statePayload.codeVerifier,
    client_id: vkClientId,
    redirect_uri: redirectUri,
    state: statePayload.state,
  });
  if (deviceId) {
    tokenParams.set("device_id", deviceId);
  }
  if (vkClientSecret) {
    tokenParams.set("client_secret", vkClientSecret);
  }

  const vkTokenResp = await fetch("https://id.vk.com/oauth2/auth", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString(),
  });
  const vkTokenJson = (await vkTokenResp.json()) as {
    access_token?: string;
    user_id?: number | string;
    error_description?: string;
    error?: string;
  };

  if (!vkTokenResp.ok || !vkTokenJson.access_token) {
    throw new Error(
      vkTokenJson.error_description || vkTokenJson.error || "Не удалось получить токен VK ID."
    );
  }

  const infoParams = new URLSearchParams({
    client_id: vkClientId,
    access_token: vkTokenJson.access_token,
  });

  const vkUserResp = await fetch("https://id.vk.com/oauth2/user_info", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: infoParams.toString(),
  });
  const vkUserJson = (await vkUserResp.json()) as {
    user?: {
      user_id?: string | number;
      first_name?: string;
      last_name?: string;
      email?: string;
      avatar?: string;
    };
  };

  const vkUser = vkUserJson.user;
  const userId = vkUser?.user_id ?? vkTokenJson.user_id;
  if (!vkUserResp.ok || !userId) {
    throw new Error("Не удалось загрузить профиль пользователя VK ID.");
  }

  const fullName = [vkUser?.first_name, vkUser?.last_name].filter(Boolean).join(" ").trim();
  const email = vkUser?.email ? vkUser.email.trim().toLowerCase() : null;

  return {
    provider: "vk",
    providerUserId: String(userId),
    email,
    emailVerified: Boolean(email),
    name: fullName || "Пользователь VK",
    avatarUrl: vkUser?.avatar || undefined,
  };
}
