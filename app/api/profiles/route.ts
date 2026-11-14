import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserFromRequest } from "@/lib/auth/session";
import {
  listCatalogProfilesFromDb,
  saveCatalogProfilesToDb,
} from "@/lib/db/projectsRepository";
import { materialProfileSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const catalogPayloadSchema = z.object({
  profiles: z.array(materialProfileSchema).min(1),
});

export async function GET(request?: Request) {
  try {
    const user = request ? getSessionUserFromRequest(request) : null;
    if (!user) {
      return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
    }

    const profiles = listCatalogProfilesFromDb(user.id);
    return NextResponse.json({ profiles });
  } catch (error) {
    console.error("SQLite GET /api/profiles error:", error);
    return NextResponse.json(
      { error: "Не удалось загрузить каталог профилей." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
    }

    const body = await request.json();
    const parsed = catalogPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Некорректный каталог профилей." },
        { status: 400 }
      );
    }
    saveCatalogProfilesToDb(parsed.data.profiles, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("SQLite PUT /api/profiles error:", error);
    return NextResponse.json(
      { error: "Ошибка сохранения каталога профилей в SQLite." },
      { status: 500 }
    );
  }
}
