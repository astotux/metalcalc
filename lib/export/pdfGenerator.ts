import { buildProjectExportData, formatMoney, type ProjectExportData } from "@/lib/export/buildExportSummary";
import {
  computeElementTrims,
  projectBeamPolygon2D,
  sortElementsByPlaneDepth,
} from "@/lib/geometry/jointTrimming";
import type { MaterialProfile, MetalCalcProject } from "@/types";

interface PdfMakeRuntime {
  sharedVirtualfs: {
    writeFileSync: (filename: string, content: string | Buffer) => void;
  };
  addFonts: (fonts: Record<string, Record<string, string>>) => void;
  setUrlAccessPolicy: (callback: (url: string) => boolean) => void;
  setLocalAccessPolicy: (callback: (path: string) => boolean) => void;
  createPdf: (docDefinition: Record<string, unknown>) => {
    getBuffer: () => Promise<Uint8Array | Buffer>;
  };
}

let pdfMakeInitialized = false;

async function getPdfMakeRuntime(): Promise<PdfMakeRuntime> {
  const pdfmakeModule = (await import("pdfmake")) as unknown as {
    default?: PdfMakeRuntime;
  } & PdfMakeRuntime;
  const runtime: PdfMakeRuntime = pdfmakeModule.default ?? pdfmakeModule;

  if (!pdfMakeInitialized) {
    const vfsModule = (await import("pdfmake/build/vfs_fonts")) as unknown as {
      default?: Record<string, string>;
    } & Record<string, string>;
    const vfsSource = vfsModule.default ?? vfsModule;

    for (const [fileName, base64Content] of Object.entries(vfsSource)) {
      if (typeof base64Content === "string" && fileName.endsWith(".ttf")) {
        runtime.sharedVirtualfs.writeFileSync(fileName, Buffer.from(base64Content, "base64"));
      }
    }

    runtime.addFonts({
      Roboto: {
        normal: "Roboto-Regular.ttf",
        bold: "Roboto-Medium.ttf",
        italics: "Roboto-Italic.ttf",
        bolditalics: "Roboto-MediumItalic.ttf",
      },
    });
    runtime.setUrlAccessPolicy(() => false);
    runtime.setLocalAccessPolicy(() => false);
    pdfMakeInitialized = true;
  }

  return runtime;
}

function normalizeHexColor(color: string | undefined, fallback = "#2563eb"): string {
  if (!color) return fallback;
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

type PdfOrthoPlane = "xy" | "xz" | "yz";

function projectToPdfPlane(
  x: number,
  y: number,
  z: number,
  plane: PdfOrthoPlane
): { u: number; vScreen: number } {
  if (plane === "xz") {
    return { u: x, vScreen: -z };
  }
  if (plane === "yz") {
    return { u: y, vScreen: -z };
  }
  return { u: x, vScreen: y };
}

function buildProjectionCanvas(
  project: MetalCalcProject,
  profileMap: Map<string, MaterialProfile>,
  plane: PdfOrthoPlane,
  canvasWidth: number,
  canvasHeight: number
): Record<string, unknown>[] {
  const padding = plane === "xy" ? 18 : 14;

  const canvasItems: Record<string, unknown>[] = [
    {
      type: "rect",
      x: 0,
      y: 0,
      w: canvasWidth,
      h: canvasHeight,
      r: 3,
      color: "#f8fafc",
      lineColor: "#cbd5e1",
      lineWidth: 0.9,
    },
  ];

  // Лёгкая вспомогательная сетка чертежа
  const gridStep = plane === "xy" ? 24 : 20;
  for (let gx = gridStep; gx < canvasWidth; gx += gridStep) {
    canvasItems.push({
      type: "line",
      x1: gx,
      y1: 0,
      x2: gx,
      y2: canvasHeight,
      lineWidth: 0.35,
      lineColor: "#e2e8f0",
    });
  }
  for (let gy = gridStep; gy < canvasHeight; gy += gridStep) {
    canvasItems.push({
      type: "line",
      x1: 0,
      y1: gy,
      x2: canvasWidth,
      y2: gy,
      lineWidth: 0.35,
      lineColor: "#e2e8f0",
    });
  }

  if (project.elements.length === 0) {
    return canvasItems;
  }

  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;

  for (const el of project.elements) {
    const p1 = projectToPdfPlane(el.start.x, el.start.y, el.start.z, plane);
    const p2 = projectToPdfPlane(el.end.x, el.end.y, el.end.z, plane);
    minU = Math.min(minU, p1.u, p2.u);
    maxU = Math.max(maxU, p1.u, p2.u);
    minV = Math.min(minV, p1.vScreen, p2.vScreen);
    maxV = Math.max(maxV, p1.vScreen, p2.vScreen);
  }

  const rawSpanU = maxU - minU;
  const rawSpanV = maxV - minV;
  const spanU = Math.max(rawSpanU, 200);
  const spanV = Math.max(rawSpanV, 200);
  const drawableW = canvasWidth - padding * 2;
  const drawableH = canvasHeight - padding * 2;
  const scale = Math.min(drawableW / spanU, drawableH / spanV);

  const centerU = (minU + maxU) / 2;
  const centerV = (minV + maxV) / 2;
  const toPdfX = (u: number) =>
    Math.round((canvasWidth / 2 + (u - centerU) * scale) * 100) / 100;
  const toPdfY = (v: number) =>
    Math.round((canvasHeight / 2 + (v - centerV) * scale) * 100) / 100;

  const lineOutlineWidth = plane === "xy" ? 4.0 : 3.4;
  const lineCoreWidth = plane === "xy" ? 2.4 : 2.0;
  const trims = computeElementTrims(project.elements, project.profiles, project.joints);
  const sortedElements = sortElementsByPlaneDepth(
    project.elements,
    profileMap,
    trims,
    plane
  );

  for (const el of sortedElements) {
    const p1 = projectToPdfPlane(el.start.x, el.start.y, el.start.z, plane);
    const p2 = projectToPdfPlane(el.end.x, el.end.y, el.end.z, plane);
    const x1 = toPdfX(p1.u);
    const y1 = toPdfY(p1.vScreen);
    const x2 = toPdfX(p2.u);
    const y2 = toPdfY(p2.vScreen);
    const profile = profileMap.get(el.profileId);
    const beamColor = normalizeHexColor(el.color ?? profile?.color, "#2563eb");
    const widthPt = (profile?.widthMm ?? 40) * scale;

    if (Math.hypot(x2 - x1, y2 - y1) < 1.2) {
      // Перпендикулярная плоскости труба (например, вертикальная стойка на виде сверху XY)
      canvasItems.push({
        type: "ellipse",
        x: x1,
        y: y1,
        r1: Math.max(2.6, Math.min(5, widthPt / 2)),
        r2: Math.max(2.6, Math.min(5, widthPt / 2)),
        color: beamColor,
        lineColor: "#1e293b",
        lineWidth: 0.9,
      });
    } else if (widthPt >= 1.8) {
      const poly2D = projectBeamPolygon2D(el, profile, trims.get(el.id), plane);
      if (poly2D.length >= 3) {
        canvasItems.push({
          type: "polyline",
          closePath: true,
          points: poly2D.map((pt) => ({
            x: toPdfX(pt.x),
            y: toPdfY(plane === "xy" ? pt.y : -pt.y),
          })),
          color: beamColor,
          lineColor: "#1e293b",
          lineWidth: 0.45,
        });
      }
    } else {
      canvasItems.push({
        type: "line",
        x1,
        y1,
        x2,
        y2,
        lineWidth: lineOutlineWidth,
        lineColor: "#1e293b",
        lineCap: "round",
      });
      canvasItems.push({
        type: "line",
        x1,
        y1,
        x2,
        y2,
        lineWidth: lineCoreWidth,
        lineColor: beamColor,
        lineCap: "round",
      });
    }
  }

  for (const joint of project.joints) {
    const jp = projectToPdfPlane(
      joint.position.x,
      joint.position.y,
      joint.position.z,
      plane
    );
    canvasItems.push({
      type: "ellipse",
      x: toPdfX(jp.u),
      y: toPdfY(jp.vScreen),
      r1: plane === "xy" ? 2.6 : 2.1,
      r2: plane === "xy" ? 2.6 : 2.1,
      color: "#f59e0b",
      lineColor: "#78350f",
      lineWidth: 0.6,
    });
  }

  return canvasItems;
}

function buildVectorDrawingBlock(
  project: MetalCalcProject,
  data: ProjectExportData
): Record<string, unknown>[] {
  const profileMap = new Map<string, MaterialProfile>();
  for (const profile of project.profiles) {
    profileMap.set(profile.id, profile);
  }

  const { boundsMm } = data;
  const xyCanvas = buildProjectionCanvas(project, profileMap, "xy", 315, 198);
  const xzCanvas = buildProjectionCanvas(project, profileMap, "xz", 192, 91);
  const yzCanvas = buildProjectionCanvas(project, profileMap, "yz", 192, 91);

  const dimensionSummary =
    project.elements.length > 0
      ? `Габариты конструкции: X (ширина) ${boundsMm.widthMm} мм × Y (глубина) ${boundsMm.heightMm} мм × Z (высота) ${boundsMm.depthMm} мм · Узлов сварки: ${project.joints.length}`
      : "Чертёж пуст — в проекте пока нет конструктивных элементов.";

  const legendColumns = data.materialRows.map((item) => ({
    width: "auto",
    margin: [0, 0, 12, 2],
    columns: [
      {
        width: 10,
        canvas: [
          {
            type: "rect",
            x: 0,
            y: 2,
            w: 8,
            h: 8,
            r: 1,
            color: normalizeHexColor(item.color),
          },
        ],
      },
      {
        width: "auto",
        text: `${item.profileName} (${item.dimensionsLabel})`,
        fontSize: 8,
        color: "#334155",
        margin: [3, 1, 0, 0],
      },
    ],
  }));

  return [
    { text: "Чертёж конструкции (3 проекции)", style: "sectionTitle" },
    {
      columns: [
        {
          width: 315,
          stack: [
            {
              text: `Главный вид · Сверху (XY): ${boundsMm.widthMm} × ${boundsMm.heightMm} мм`,
              fontSize: 7.5,
              bold: true,
              color: "#334155",
              margin: [0, 0, 0, 2],
            },
            { canvas: xyCanvas },
          ],
        },
        {
          width: 192,
          stack: [
            {
              text: `Вид спереди (XZ): ${boundsMm.widthMm} × ${boundsMm.depthMm} мм`,
              fontSize: 7.5,
              bold: true,
              color: "#334155",
              margin: [0, 0, 0, 2],
            },
            { canvas: xzCanvas, margin: [0, 0, 0, 5] },
            {
              text: `Вид сбоку (YZ): ${boundsMm.heightMm} × ${boundsMm.depthMm} мм`,
              fontSize: 7.5,
              bold: true,
              color: "#334155",
              margin: [0, 0, 0, 2],
            },
            { canvas: yzCanvas },
          ],
        },
      ],
      columnGap: 8,
      margin: [0, 0, 0, 4],
    },
    { text: dimensionSummary, fontSize: 8.5, color: "#475569", margin: [0, 0, 0, 4] },
    ...(legendColumns.length > 0
      ? [{ columns: legendColumns, columnGap: 6, margin: [0, 0, 0, 10] }]
      : []),
  ];
}

/**
 * Генерирует PDF-документ (.pdf) со сметой, чертежом, списком материалов,
 * расчётом работ (покраска, сварка) и спецификацией элементов.
 */
export async function generatePdfBuffer(
  project: MetalCalcProject,
  drawingImageDataUrl?: string
): Promise<Buffer> {
  const runtime = await getPdfMakeRuntime();
  const data = buildProjectExportData(project);
  const { estimate, workSummary } = data;

  const materialBody: unknown[][] = [
    [
      { text: "Материал", style: "tableHeader" },
      { text: "Сечение", style: "tableHeader" },
      { text: "Стенка", style: "tableHeader", alignment: "right" },
      { text: "Шт.", style: "tableHeader", alignment: "right" },
      { text: "Длина, м", style: "tableHeader", alignment: "right" },
      { text: "Цена / м", style: "tableHeader", alignment: "right" },
      { text: "Стоимость", style: "tableHeader", alignment: "right" },
    ],
  ];

  if (data.materialRows.length === 0) {
    materialBody.push([
      {
        text: "В проекте пока нет элементов конструкции.",
        colSpan: 7,
        alignment: "center",
        color: "#64748b",
        margin: [0, 6, 0, 6],
      },
      {},
      {},
      {},
      {},
      {},
      {},
    ]);
  } else {
    for (const row of data.materialRows) {
      materialBody.push([
        { text: row.profileName, bold: true },
        row.dimensionsLabel,
        { text: `${row.wallThicknessMm} мм`, alignment: "right" },
        { text: String(row.elementCount), alignment: "right" },
        { text: row.totalLengthMeters.toFixed(3), alignment: "right" },
        { text: formatMoney(row.pricePerMeter, estimate.currency), alignment: "right" },
        { text: formatMoney(row.totalCost, estimate.currency), alignment: "right", bold: true },
      ]);
    }
  }

  materialBody.push([
    { text: "Итого материалы", bold: true, fillColor: "#f1f5f9", colSpan: 4 },
    {},
    {},
    {},
    {
      text: `${estimate.totalLengthMeters.toFixed(3)} м`,
      bold: true,
      alignment: "right",
      fillColor: "#f1f5f9",
    },
    { text: "", fillColor: "#f1f5f9" },
    {
      text: formatMoney(estimate.metalCost, estimate.currency),
      bold: true,
      alignment: "right",
      fillColor: "#f1f5f9",
    },
  ]);

  const elementBody: unknown[][] = [
    [
      { text: "№", style: "tableHeader" },
      { text: "Элемент", style: "tableHeader" },
      { text: "Профиль", style: "tableHeader" },
      { text: "Длина, мм", style: "tableHeader", alignment: "right" },
      { text: "Покраска", style: "tableHeader", alignment: "center" },
      { text: "Металл", style: "tableHeader", alignment: "right" },
    ],
    ...data.elementRows.map((el) => [
      String(el.index),
      el.name,
      `${el.profileName} (${el.dimensionsLabel})`,
      { text: String(el.lengthMm), alignment: "right" },
      { text: el.excludeFromPainting ? "Нет" : "Да", alignment: "center" },
      { text: formatMoney(el.materialCost, estimate.currency), alignment: "right" },
    ]),
  ];

  const hasValidSnapshot =
    typeof drawingImageDataUrl === "string" &&
    /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(drawingImageDataUrl);

  const docDefinition: Record<string, unknown> = {
    pageSize: "A4",
    pageMargins: [40, 36, 40, 42],
    defaultStyle: {
      font: "Roboto",
      fontSize: 9,
      color: "#0f172a",
    },
    styles: {
      docTitle: { fontSize: 16, bold: true, color: "#0f172a" },
      sectionTitle: {
        fontSize: 11,
        bold: true,
        color: "#1e3a5f",
        margin: [0, 8, 0, 5],
      },
      tableHeader: {
        fontSize: 8.5,
        bold: true,
        color: "#ffffff",
        fillColor: "#1e3a5f",
      },
    },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        {
          text: `MetalCalc · ${data.projectName}`,
          fontSize: 8,
          color: "#64748b",
          margin: [40, 10, 0, 0],
        },
        {
          text: `Страница ${currentPage} из ${pageCount}`,
          fontSize: 8,
          color: "#64748b",
          alignment: "right",
          margin: [0, 10, 40, 0],
        },
      ],
    }),
    content: [
      {
        columns: [
          {
            stack: [
              { text: data.projectName, style: "docTitle" },
              {
                text: `Смета и спецификация металлоконструкции · Дата: ${data.exportedAtLabel}${
                  data.isExample ? " · Примерные цены" : ""
                }`,
                fontSize: 8.5,
                color: "#475569",
                margin: [0, 3, 0, 0],
              },
            ],
          },
          {
            width: 130,
            stack: [
              {
                text: "ИТОГО ПО СМЕТЕ",
                fontSize: 7.5,
                bold: true,
                color: "#475569",
                alignment: "right",
              },
              {
                text: formatMoney(estimate.totalCost, estimate.currency),
                fontSize: 14,
                bold: true,
                color: "#1d4ed8",
                alignment: "right",
              },
            ],
          },
        ],
        margin: [0, 0, 0, 8],
      },

      ...buildVectorDrawingBlock(project, data),

      ...(hasValidSnapshot
        ? [
            { text: "Снимок активного вида", style: "sectionTitle" },
            {
              image: drawingImageDataUrl,
              fit: [515, 160],
              alignment: "center",
              margin: [0, 0, 0, 8],
            },
          ]
        : []),

      { text: "Список материалов", style: "sectionTitle" },
      {
        table: {
          headerRows: 1,
          widths: ["*", 74, 42, 30, 52, 62, 68],
          body: materialBody,
        },
        layout: {
          hLineColor: () => "#cbd5e1",
          vLineColor: () => "#cbd5e1",
          paddingLeft: () => 5,
          paddingRight: () => 5,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
        margin: [0, 0, 0, 8],
      },

      { text: "Стоимость работ и итоговая смета", style: "sectionTitle" },
      {
        table: {
          widths: ["*", 180, 90],
          body: [
            [
              "Стоимость материалов (металлопрокат)",
              `${estimate.elementCount} эл., общая длина ${estimate.totalLengthMeters.toFixed(3)} м`,
              { text: formatMoney(estimate.metalCost, estimate.currency), alignment: "right", bold: true },
            ],
            [
              "Покраска конструкции",
              `${workSummary.paintableLengthMeters.toFixed(3)} м × ${formatMoney(
                workSummary.paintingPricePerMeter,
                estimate.currency
              )}/м`,
              { text: formatMoney(workSummary.paintingCost, estimate.currency), alignment: "right", bold: true },
            ],
            [
              "Сварочные работы",
              `${workSummary.weldModeLabel}: ${workSummary.jointCount} соед.${
                workSummary.knownWeldLengthMeters > 0
                  ? ` (${workSummary.knownWeldLengthMeters.toFixed(3)} м шва)`
                  : ""
              }`,
              { text: formatMoney(workSummary.weldingCost, estimate.currency), alignment: "right", bold: true },
            ],
            [
              { text: "ИТОГОВАЯ СУММА", bold: true, fillColor: "#dbeafe", fontSize: 10 },
              {
                text: `Валюта расчёта: ${estimate.currency}`,
                fillColor: "#dbeafe",
                color: "#1e3a8a",
              },
              {
                text: formatMoney(estimate.totalCost, estimate.currency),
                bold: true,
                alignment: "right",
                fillColor: "#dbeafe",
                fontSize: 11,
                color: "#1d4ed8",
              },
            ],
          ],
        },
        layout: {
          hLineColor: () => "#cbd5e1",
          vLineColor: () => "#cbd5e1",
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
        margin: [0, 0, 0, 8],
      },

      ...(data.elementRows.length > 0
        ? [
            { text: "Спецификация конструктивных элементов", style: "sectionTitle" },
            {
              table: {
                headerRows: 1,
                widths: [24, "*", 140, 56, 48, 68],
                body: elementBody,
              },
              layout: {
                hLineColor: () => "#e2e8f0",
                vLineColor: () => "#e2e8f0",
                paddingLeft: () => 4,
                paddingRight: () => 4,
                paddingTop: () => 3,
                paddingBottom: () => 3,
              },
            },
          ]
        : []),
    ],
  };

  const pdfDoc = runtime.createPdf(docDefinition);
  const rawBuffer = await pdfDoc.getBuffer();
  return Buffer.from(rawBuffer);
}
