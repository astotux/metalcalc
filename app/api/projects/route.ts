import { NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth/session";
import {
  listProjectsFromDb,
  ProjectForbiddenError,
  saveProjectToDb,
} from "@/lib/db/projectsRepository";
import { metalCalcProjectSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request?: Request) {
  try {
    const user = request ? getSessionUserFromRequest(request) : null;
    if (!user) {
      return NextResponse.json(
        { error: "Требуется авторизация." },
        { status: 401 }
      );
    }

    const projects = listProjectsFromDb(user.id);
    return NextResponse.json({ projects });
  } catch (error) {
    console.error("SQLite GET /api/projects error:", error);
    return NextResponse.json(
      { error: "Не удалось получить список проектов из базы данных." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "Требуется авторизация." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = metalCalcProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Некорректные данные проекта.",
          details: parsed.error.issues[0]?.message,
        },
        { status: 400 }
      );
    }

    const saved = saveProjectToDb(parsed.data, user.id);
    return NextResponse.json({ project: saved }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("SQLite POST /api/projects error:", error);
    return NextResponse.json(
      { error: "Ошибка сохранения проекта в SQLite." },
      { status: 500 }
    );
  }
}
