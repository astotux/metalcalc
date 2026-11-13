import { NextResponse } from "next/server";
import { z } from "zod";
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

export async function GET() {
  try {
    const profiles = listCatalogProfilesFromDb();
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
    const body = await request.json();
    const parsed = catalogPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Некорректный каталог профилей." },
        { status: 400 }
      );
    }
    saveCatalogProfilesToDb(parsed.data.profiles);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("SQLite PUT /api/profiles error:", error);
    return NextResponse.json(
      { error: "Ошибка сохранения каталога профилей в SQLite." },
      { status: 500 }
    );
  }
}
