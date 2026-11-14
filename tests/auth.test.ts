import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as meRoute } from "@/app/api/auth/me/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { GET as oauthStartRoute } from "@/app/api/auth/oauth/[provider]/route";
import { POST as registerRoute } from "@/app/api/auth/register/route";
import { POST as verifyEmailRoute } from "@/app/api/auth/verify-email/route";
import { GET as getProfilesRoute, PUT as putProfilesRoute } from "@/app/api/profiles/route";
import { GET as getProjectsRoute, POST as postProjectRoute } from "@/app/api/projects/route";
import {
  DELETE as deleteProjectRoute,
  GET as getProjectByIdRoute,
  PATCH as patchProjectRoute,
  PUT as putProjectByIdRoute,
} from "@/app/api/projects/[id]/route";
import { EXAMPLE_PROFILES } from "@/features/profiles/defaults";
import { createEmptyProject } from "@/features/projects/defaults";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { evaluatePasswordStrength } from "@/lib/auth/passwordStrength";
import { issueSessionForUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { resetDatabaseForTests } from "@/lib/db/sqlite";
import { upsertOAuthUser } from "@/lib/db/usersRepository";

function extractCookieValue(setCookieHeader: string | null, name: string): string | null {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] ?? null;
}

describe("MetalCalc Auth (SQLite, Email Code, Password Strength, OAuth)", () => {
  const prevYandexId = process.env.YANDEX_CLIENT_ID;
  const prevYandexSecret = process.env.YANDEX_CLIENT_SECRET;

  beforeEach(() => {
    process.env.METALCALC_DB_PATH = ":memory:";
    resetDatabaseForTests();
  });

  afterEach(() => {
    resetDatabaseForTests();
    delete process.env.METALCALC_DB_PATH;

    if (prevYandexId === undefined) delete process.env.YANDEX_CLIENT_ID;
    else process.env.YANDEX_CLIENT_ID = prevYandexId;

    if (prevYandexSecret === undefined) delete process.env.YANDEX_CLIENT_SECRET;
    else process.env.YANDEX_CLIENT_SECRET = prevYandexSecret;
  });

  it("evaluates password strength accurately and verifies scrypt hashes", () => {
    expect(evaluatePasswordStrength("12345678").isAcceptable).toBe(false);
    expect(evaluatePasswordStrength("weakpass").isAcceptable).toBe(false);
    expect(evaluatePasswordStrength("StrongPass1").isAcceptable).toBe(false); // нет спецсимвола
    expect(evaluatePasswordStrength("Strong Pass!1").isAcceptable).toBe(false); // есть пробел

    const strong = evaluatePasswordStrength("MetalCalc!2026");
    expect(strong.isAcceptable).toBe(true);
    expect(strong.score).toBe(4);

    const hash = hashPassword("MetalCalc!2026");
    expect(verifyPassword("MetalCalc!2026", hash)).toBe(true);
    expect(verifyPassword("WrongPass!2026", hash)).toBe(false);
  });

  it("registers user, rejects weak password, verifies 6-digit email code, and manages session", async () => {
    // 1. Слабый пароль отклоняется
    const weakRes = await registerRoute(
      new Request("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Иван",
          email: "ivan@example.com",
          password: "password123",
        }),
      })
    );
    expect(weakRes.status).toBe(400);

    // 2. Успешная регистрация и генерация 6-значного кода
    const regRes = await registerRoute(
      new Request("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Иван Петров",
          email: "ivan@example.com",
          password: "MetalCalc!2026",
        }),
      })
    );
    expect(regRes.status).toBe(201);
    const regJson = (await regRes.json()) as {
      ok: boolean;
      requiresVerification: boolean;
      devPreviewCode?: string;
    };
    expect(regJson.ok).toBe(true);
    expect(regJson.requiresVerification).toBe(true);
    expect(regJson.devPreviewCode).toMatch(/^\d{6}$/);

    // 3. Вход до подтверждения почты возвращает requiresVerification (403)
    const unverifiedLoginRes = await loginRoute(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "ivan@example.com",
          password: "MetalCalc!2026",
        }),
      })
    );
    expect(unverifiedLoginRes.status).toBe(403);

    // 4. Неверный код уменьшает счётчик попыток
    const badCodeRes = await verifyEmailRoute(
      new Request("http://localhost:3000/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "ivan@example.com",
          code: regJson.devPreviewCode === "000000" ? "111111" : "000000",
        }),
      })
    );
    expect(badCodeRes.status).toBe(400);
    const badCodeJson = (await badCodeRes.json()) as { attemptsLeft?: number };
    expect(badCodeJson.attemptsLeft).toBe(4);

    // 5. Правильный код подтверждает почту и выдаёт session cookie
    const verifyRes = await verifyEmailRoute(
      new Request("http://localhost:3000/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "ivan@example.com",
          code: regJson.devPreviewCode,
        }),
      })
    );
    expect(verifyRes.status).toBe(200);
    const sessionCookie = extractCookieValue(
      verifyRes.headers.get("set-cookie"),
      "mc_session"
    );
    expect(sessionCookie).toBeTruthy();

    // 6. /api/auth/me с cookie возвращает пользователя
    const meRes = await meRoute(
      new Request("http://localhost:3000/api/auth/me", {
        headers: { cookie: `mc_session=${sessionCookie}` },
      })
    );
    expect(meRes.status).toBe(200);
    const meJson = (await meRes.json()) as {
      user: { email: string; emailVerified: boolean } | null;
    };
    expect(meJson.user?.email).toBe("ivan@example.com");
    expect(meJson.user?.emailVerified).toBe(true);

    // 7. Logout отзывает сессию в SQLite
    const logoutRes = await logoutRoute(
      new Request("http://localhost:3000/api/auth/logout", {
        method: "POST",
        headers: { cookie: `mc_session=${sessionCookie}` },
      })
    );
    expect(logoutRes.status).toBe(200);

    const meAfterLogout = await meRoute(
      new Request("http://localhost:3000/api/auth/me", {
        headers: { cookie: `mc_session=${sessionCookie}` },
      })
    );
    const meAfterJson = (await meAfterLogout.json()) as { user: unknown };
    expect(meAfterJson.user).toBeNull();
  });

  it("handles Yandex OAuth authorization URLs and account linking", async () => {
    delete process.env.YANDEX_CLIENT_ID;
    delete process.env.YANDEX_CLIENT_SECRET;

    // Без ключей в env аккуратно редиректит на /login с понятным oauthError
    const unconfiguredYandex = await oauthStartRoute(
      new Request("http://localhost:3000/api/auth/oauth/yandex"),
      { params: Promise.resolve({ provider: "yandex" }) }
    );
    expect(unconfiguredYandex.status).toBe(307);
    expect(unconfiguredYandex.headers.get("location")).toContain("/login?oauthError=");

    // Неизвестный/удалённый провайдер (например, vk) отклоняется с oauthError
    const unsupportedRes = await oauthStartRoute(
      new Request("http://localhost:3000/api/auth/oauth/vk"),
      { params: Promise.resolve({ provider: "vk" }) }
    );
    expect(unsupportedRes.status).toBe(307);
    expect(unsupportedRes.headers.get("location")).toContain("/login?oauthError=");

    // С заданными ключами формирует корректный OAuth-редирект и state cookie
    process.env.YANDEX_CLIENT_ID = "ya-client-id";
    process.env.YANDEX_CLIENT_SECRET = "ya-secret";

    const yandexRes = await oauthStartRoute(
      new Request("http://localhost:3000/api/auth/oauth/yandex"),
      { params: Promise.resolve({ provider: "yandex" }) }
    );
    expect(yandexRes.status).toBe(307);
    expect(yandexRes.headers.get("location")).toContain("https://oauth.yandex.ru/authorize");
    expect(yandexRes.headers.get("set-cookie")).toContain("mc_oauth_state=");

    // Проверяем создание и повторный вход через OAuth-профиль в SQLite
    const oauthUser = upsertOAuthUser({
      provider: "yandex",
      providerUserId: "ya-user-42",
      email: "oauth@yandex.ru",
      emailVerified: true,
      name: "Олег Яндекс",
    });
    expect(oauthUser.email).toBe("oauth@yandex.ru");
    expect(oauthUser.providers).toContain("yandex");

    const repeatedLogin = upsertOAuthUser({
      provider: "yandex",
      providerUserId: "ya-user-42",
      email: "oauth@yandex.ru",
      emailVerified: true,
      name: "Олег Яндекс",
    });
    expect(repeatedLogin.id).toBe(oauthUser.id);
    expect(repeatedLogin.providers).toEqual(["yandex"]);
  });

  it("enforces strict per-user isolation for projects and profile catalogs across API routes", async () => {
    // 1. Без авторизации доступ к проектам и профилям закрыт (401)
    expect((await getProjectsRoute(new Request("http://localhost/api/projects"))).status).toBe(401);
    expect((await getProfilesRoute(new Request("http://localhost/api/profiles"))).status).toBe(401);

    const userA = upsertOAuthUser({
      provider: "yandex",
      providerUserId: "iso-user-a",
      email: "usera@example.com",
      emailVerified: true,
      name: "User A",
    });
    const userB = upsertOAuthUser({
      provider: "yandex",
      providerUserId: "iso-user-b",
      email: "userb@example.com",
      emailVerified: true,
      name: "User B",
    });

    const cookieA = `${SESSION_COOKIE_NAME}=${issueSessionForUser(userA.id, true).rawToken}`;
    const cookieB = `${SESSION_COOKIE_NAME}=${issueSessionForUser(userB.id, true).rawToken}`;

    // 2. Каждый пользователь получает собственный пример и не видит пример другого
    const listA0 = (await (
      await getProjectsRoute(new Request("http://localhost/api/projects", { headers: { cookie: cookieA } }))
    ).json()) as { projects: Array<{ id: string }> };
    const listB0 = (await (
      await getProjectsRoute(new Request("http://localhost/api/projects", { headers: { cookie: cookieB } }))
    ).json()) as { projects: Array<{ id: string }> };

    expect(listA0.projects).toHaveLength(1);
    expect(listB0.projects).toHaveLength(1);
    expect(listA0.projects[0].id).not.toBe(listB0.projects[0].id);

    // 3. Пользователь A создаёт личный проект — Пользователь B не может читать/править/удалять его
    const projectA = createEmptyProject("Секретный навес А");
    projectA.id = "proj-secret-a";
    const createARes = await postProjectRoute(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: cookieA },
        body: JSON.stringify(projectA),
      })
    );
    expect(createARes.status).toBe(201);

    const listBAfter = (await (
      await getProjectsRoute(new Request("http://localhost/api/projects", { headers: { cookie: cookieB } }))
    ).json()) as { projects: Array<{ id: string }> };
    expect(listBAfter.projects.some((p) => p.id === projectA.id)).toBe(false);

    expect(
      (
        await getProjectByIdRoute(
          new Request(`http://localhost/api/projects/${projectA.id}`, {
            headers: { cookie: cookieB },
          }),
          { params: Promise.resolve({ id: projectA.id }) }
        )
      ).status
    ).toBe(404);

    expect(
      (
        await putProjectByIdRoute(
          new Request(`http://localhost/api/projects/${projectA.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", cookie: cookieB },
            body: JSON.stringify({ ...projectA, name: "Взломано" }),
          }),
          { params: Promise.resolve({ id: projectA.id }) }
        )
      ).status
    ).toBe(403);

    expect(
      (
        await patchProjectRoute(
          new Request(`http://localhost/api/projects/${projectA.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", cookie: cookieB },
            body: JSON.stringify({ action: "rename", name: "Чужое имя" }),
          }),
          { params: Promise.resolve({ id: projectA.id }) }
        )
      ).status
    ).toBe(404);

    expect(
      (
        await deleteProjectRoute(
          new Request(`http://localhost/api/projects/${projectA.id}`, {
            method: "DELETE",
            headers: { cookie: cookieB },
          }),
          { params: Promise.resolve({ id: projectA.id }) }
        )
      ).status
    ).toBe(404);

    // 4. Каталог профилей также изолирован между A и B
    const customProfilesA = [
      ...EXAMPLE_PROFILES,
      {
        id: "prof-a-only",
        name: "Спецпрофиль A",
        shapeType: "square_tube" as const,
        widthMm: 80,
        heightMm: 80,
        wallThicknessMm: 3,
        pricePerMeter: 999,
        color: "#ff0000",
      },
    ];
    expect(
      (
        await putProfilesRoute(
          new Request("http://localhost/api/profiles", {
            method: "PUT",
            headers: { "Content-Type": "application/json", cookie: cookieA },
            body: JSON.stringify({ profiles: customProfilesA }),
          })
        )
      ).status
    ).toBe(200);

    const profilesA = (await (
      await getProfilesRoute(new Request("http://localhost/api/profiles", { headers: { cookie: cookieA } }))
    ).json()) as { profiles: Array<{ id: string }> };
    const profilesB = (await (
      await getProfilesRoute(new Request("http://localhost/api/profiles", { headers: { cookie: cookieB } }))
    ).json()) as { profiles: Array<{ id: string }> };

    expect(profilesA.profiles.some((p) => p.id === "prof-a-only")).toBe(true);
    expect(profilesB.profiles.some((p) => p.id === "prof-a-only")).toBe(false);
  });
});
