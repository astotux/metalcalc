import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserFromRequest } from "@/lib/auth/session";
import {
  deleteProjectInDb,
  duplicateProjectInDb,
  getProjectFromDb,
  ProjectForbiddenError,
  renameProjectInDb,
  saveProjectToDb,
} from "@/lib/db/projectsRepository";
import { metalCalcProjectSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("rename"),
    name: z.string().trim().min(1, "Укажите название проекта").max(120),
  }),
  z.object({
    action: z.literal("duplicate"),
    name: z.string().trim().max(120).optional(),
  }),
]);

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
    }

    const { id } = await context.params;
    const project = getProjectFromDb(id, user.id);
    if (!project) {
      return NextResponse.json({ error: "Проект не найден." }, { status: 404 });
    }
    return NextResponse.json({ project });
  } catch (error) {
    console.error("SQLite GET /api/projects/[id] error:", error);
    return NextResponse.json({ error: "Ошибка чтения проекта." }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const parsed = metalCalcProjectSchema.safeParse({ ...body, id });
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
    return NextResponse.json({ project: saved });
  } catch (error) {
    if (error instanceof ProjectForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("SQLite PUT /api/projects/[id] error:", error);
    return NextResponse.json({ error: "Ошибка обновления проекта." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Некорректный запрос." },
        { status: 400 }
      );
    }

    if (parsed.data.action === "rename") {
      const renamed = renameProjectInDb(id, parsed.data.name, user.id);
      if (!renamed) {
        return NextResponse.json({ error: "Проект не найден." }, { status: 404 });
      }
      return NextResponse.json({ project: renamed });
    }

    const duplicated = duplicateProjectInDb(id, parsed.data.name, user.id);
    if (!duplicated) {
      return NextResponse.json({ error: "Проект не найден." }, { status: 404 });
    }
    return NextResponse.json({ project: duplicated }, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("SQLite PATCH /api/projects/[id] error:", error);
    return NextResponse.json({ error: "Ошибка изменения проекта." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
    }

    const { id } = await context.params;
    const deleted = deleteProjectInDb(id, user.id);
    if (!deleted) {
      return NextResponse.json({ error: "Проект не найден." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("SQLite DELETE /api/projects/[id] error:", error);
    return NextResponse.json({ error: "Ошибка удаления проекта." }, { status: 500 });
  }
}
