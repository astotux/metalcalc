import { redirect } from "next/navigation";
import { getSessionUserFromCookies } from "@/lib/auth/session";
import type { AuthUser } from "@/types";

/**
 * Проверяет активную сессию в SQLite на сервере.
 * Если пользователь не авторизован — перенаправляет на страницу входа.
 */
export async function requireAuthenticatedPageUser(nextPath = "/"): Promise<AuthUser> {
  const user = await getSessionUserFromCookies();
  if (!user) {
    const safeNext = nextPath.startsWith("/") ? nextPath : "/";
    redirect(`/login?next=${encodeURIComponent(safeNext)}`);
  }
  return user;
}
