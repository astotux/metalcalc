import { NextResponse } from "next/server";
import { buildExportFileName } from "@/lib/export/buildExportSummary";
import { generateExcelBuffer } from "@/lib/export/excelGenerator";
import { metalCalcProjectSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const rawProject =
      body && typeof body === "object" && "project" in body
        ? (body as { project: unknown }).project
        : body;

    const parsed = metalCalcProjectSchema.safeParse(rawProject);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Некорректные данные проекта для экспорта в Excel",
          details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        },
        { status: 400 }
      );
    }

    const buffer = await generateExcelBuffer(parsed.data);
    const encodedName = encodeURIComponent(buildExportFileName(parsed.data.name, "xlsx"));

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="metalcalc_smeta.xlsx"; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Не удалось сформировать Excel-файл",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
