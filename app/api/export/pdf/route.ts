import { NextResponse } from "next/server";
import { buildExportFileName } from "@/lib/export/buildExportSummary";
import { generatePdfBuffer } from "@/lib/export/pdfGenerator";
import { metalCalcProjectSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const isWrapped = body && typeof body === "object" && "project" in body;
    const rawProject = isWrapped ? (body as { project: unknown }).project : body;
    const drawingImageDataUrl =
      isWrapped &&
      "drawingImageDataUrl" in body &&
      typeof (body as { drawingImageDataUrl?: unknown }).drawingImageDataUrl === "string"
        ? (body as { drawingImageDataUrl: string }).drawingImageDataUrl
        : undefined;

    const parsed = metalCalcProjectSchema.safeParse(rawProject);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Некорректные данные проекта для экспорта в PDF",
          details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        },
        { status: 400 }
      );
    }

    const buffer = await generatePdfBuffer(parsed.data, drawingImageDataUrl);
    const encodedName = encodeURIComponent(buildExportFileName(parsed.data.name, "pdf"));

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="metalcalc_smeta.pdf"; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Не удалось сформировать PDF-документ",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
