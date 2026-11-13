import { buildExportFileName } from "@/lib/export/buildExportSummary";
import type { MetalCalcProject } from "@/types";

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; details?: string };
    if (data.details) return `${data.error ?? fallback}: ${data.details}`;
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Экспортирует смету и спецификацию проекта в формат Excel (.xlsx). */
export async function downloadProjectExcel(project: MetalCalcProject): Promise<void> {
  const response = await fetch("/api/export/excel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Ошибка экспорта в Excel"));
  }

  const blob = await response.blob();
  triggerBlobDownload(blob, buildExportFileName(project.name, "xlsx"));
}

/** Экспортирует чертёж, смету и спецификацию проекта в формат PDF (.pdf). */
export async function downloadProjectPdf(
  project: MetalCalcProject,
  drawingImageDataUrl?: string
): Promise<void> {
  const response = await fetch("/api/export/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, drawingImageDataUrl }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Ошибка экспорта в PDF"));
  }

  const blob = await response.blob();
  triggerBlobDownload(blob, buildExportFileName(project.name, "pdf"));
}
