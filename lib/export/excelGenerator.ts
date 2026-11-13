import ExcelJS from "exceljs";
import { buildProjectExportData, formatMoney } from "@/lib/export/buildExportSummary";
import type { MetalCalcProject } from "@/types";

const CURRENCY_NUMBER_FORMAT: Record<string, string> = {
  RUB: '#,##0.00 "₽"',
  USD: '"$"#,##0.00',
  EUR: '#,##0.00 "€"',
  KZT: '#,##0.00 "₸"',
  BYN: '#,##0.00 "Br"',
};

function styleHeaderRow(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A5F" },
  };
  row.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  row.height = 24;
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "FF334155" } },
      bottom: { style: "thin", color: { argb: "FF334155" } },
      left: { style: "thin", color: { argb: "FF334155" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });
}

function applyThinBorders(row: ExcelJS.Row, colCount: number): void {
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  }
}

/**
 * Генерирует книгу Excel (.xlsx) с двумя листами:
 * 1) Смета и материалы (таблица профилей, покраска, сварка, итог)
 * 2) Спецификация элементов конструкции
 */
export async function generateExcelBuffer(project: MetalCalcProject): Promise<Buffer> {
  const data = buildProjectExportData(project);
  const { estimate, workSummary } = data;
  const moneyFmt = CURRENCY_NUMBER_FORMAT[estimate.currency] ?? "#,##0.00";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MetalCalc";
  workbook.created = new Date();

  // Лист 1: Смета и материалы
  const sheet = workbook.addWorksheet("Смета и материалы");
  sheet.columns = [
    { width: 28 }, // Название материала
    { width: 20 }, // Размер профиля
    { width: 18 }, // Толщина стенки
    { width: 16 }, // Кол-во элементов
    { width: 16 }, // Общая длина, м
    { width: 18 }, // Цена за метр
    { width: 20 }, // Стоимость
  ];

  const titleRow = sheet.addRow([`MetalCalc — Смета проекта: ${data.projectName}`]);
  titleRow.font = { bold: true, size: 14, color: { argb: "FF0F172A" } };
  sheet.mergeCells("A1:G1");

  const metaRow = sheet.addRow([
    `Дата формирования: ${data.exportedAtLabel} | Элементов: ${estimate.elementCount} | Валюта: ${estimate.currency}${
      data.isExample ? " | Примечание: примерные цены" : ""
    }`,
  ]);
  metaRow.font = { size: 10, color: { argb: "FF475569" } };
  sheet.mergeCells("A2:G2");

  sheet.addRow([]);

  const matHeader = sheet.addRow([
    "Название материала",
    "Размер профиля",
    "Толщина стенки, мм",
    "Кол-во элементов",
    "Общая длина, м",
    "Цена за метр",
    "Стоимость",
  ]);
  styleHeaderRow(matHeader);
  matHeader.getCell(3).alignment = { vertical: "middle", horizontal: "right" };
  matHeader.getCell(4).alignment = { vertical: "middle", horizontal: "right" };
  matHeader.getCell(5).alignment = { vertical: "middle", horizontal: "right" };
  matHeader.getCell(6).alignment = { vertical: "middle", horizontal: "right" };
  matHeader.getCell(7).alignment = { vertical: "middle", horizontal: "right" };

  if (data.materialRows.length === 0) {
    const emptyRow = sheet.addRow(["В проекте пока нет элементов конструкции"]);
    sheet.mergeCells(`A${emptyRow.number}:G${emptyRow.number}`);
    applyThinBorders(emptyRow, 7);
  } else {
    for (const item of data.materialRows) {
      const row = sheet.addRow([
        item.profileName,
        item.dimensionsLabel,
        item.wallThicknessMm,
        item.elementCount,
        item.totalLengthMeters,
        item.pricePerMeter,
        item.totalCost,
      ]);
      row.getCell(3).numFmt = "0.0";
      row.getCell(4).numFmt = "0";
      row.getCell(5).numFmt = "0.000";
      row.getCell(6).numFmt = moneyFmt;
      row.getCell(7).numFmt = moneyFmt;
      applyThinBorders(row, 7);
    }
  }

  const metalTotalRow = sheet.addRow([
    "Итого материалы",
    "",
    "",
    estimate.elementCount,
    estimate.totalLengthMeters,
    "",
    estimate.metalCost,
  ]);
  metalTotalRow.font = { bold: true };
  metalTotalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  };
  metalTotalRow.getCell(4).numFmt = "0";
  metalTotalRow.getCell(5).numFmt = "0.000";
  metalTotalRow.getCell(7).numFmt = moneyFmt;
  applyThinBorders(metalTotalRow, 7);

  sheet.addRow([]);

  // Блок работ и итоговой суммы
  const workHeader = sheet.addRow([
    "Работы и итоговая смета",
    "Параметры расчёта",
    "",
    "Объём",
    "Ед. изм.",
    "Тариф",
    "Стоимость",
  ]);
  styleHeaderRow(workHeader);
  sheet.mergeCells(`B${workHeader.number}:C${workHeader.number}`);
  workHeader.getCell(4).alignment = { vertical: "middle", horizontal: "right" };
  workHeader.getCell(6).alignment = { vertical: "middle", horizontal: "right" };
  workHeader.getCell(7).alignment = { vertical: "middle", horizontal: "right" };

  const paintRow = sheet.addRow([
    "Покраска конструкции",
    `Окрашиваемых метров (исключено: ${Math.max(
      0,
      Math.round((estimate.totalLengthMeters - estimate.paintableLengthMeters) * 1000) / 1000
    )} м)`,
    "",
    workSummary.paintableLengthMeters,
    "м",
    workSummary.paintingPricePerMeter,
    workSummary.paintingCost,
  ]);
  sheet.mergeCells(`B${paintRow.number}:C${paintRow.number}`);
  paintRow.getCell(4).numFmt = "0.000";
  paintRow.getCell(6).numFmt = moneyFmt;
  paintRow.getCell(7).numFmt = moneyFmt;
  applyThinBorders(paintRow, 7);

  const isPerJoint = project.calculationSettings.weldPricingMode === "per_joint";
  const weldQuantity = isPerJoint
    ? workSummary.jointCount
    : workSummary.knownWeldLengthMeters;
  const weldUnit = isPerJoint ? "соед." : "м шва";
  const weldDesc = `${workSummary.weldModeLabel}; соединений: ${workSummary.jointCount}${
    workSummary.knownWeldLengthMeters > 0
      ? `, длина швов: ${workSummary.knownWeldLengthMeters} м`
      : ""
  }`;

  const weldRow = sheet.addRow([
    "Сварочные работы",
    weldDesc,
    "",
    weldQuantity,
    weldUnit,
    workSummary.weldRate,
    workSummary.weldingCost,
  ]);
  sheet.mergeCells(`B${weldRow.number}:C${weldRow.number}`);
  weldRow.getCell(4).numFmt = isPerJoint ? "0" : "0.000";
  weldRow.getCell(6).numFmt = moneyFmt;
  weldRow.getCell(7).numFmt = moneyFmt;
  applyThinBorders(weldRow, 7);

  const grandTotalRow = sheet.addRow([
    "ИТОГОВАЯ СУММА",
    `Металл + Покраска + Сварка (${formatMoney(estimate.totalCost, estimate.currency)})`,
    "",
    "",
    "",
    "",
    estimate.totalCost,
  ]);
  sheet.mergeCells(`B${grandTotalRow.number}:F${grandTotalRow.number}`);
  grandTotalRow.font = { bold: true, size: 12, color: { argb: "FF0F172A" } };
  grandTotalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFDBEAFE" },
  };
  grandTotalRow.height = 24;
  grandTotalRow.getCell(7).numFmt = moneyFmt;
  applyThinBorders(grandTotalRow, 7);

  // Лист 2: Спецификация элементов
  const specSheet = workbook.addWorksheet("Спецификация элементов");
  specSheet.columns = [
    { width: 6 },
    { width: 22 },
    { width: 24 },
    { width: 18 },
    { width: 13 },
    { width: 13 },
    { width: 20 },
    { width: 20 },
    { width: 13 },
    { width: 18 },
  ];

  const specHeader = specSheet.addRow([
    "№",
    "Наименование",
    "Материал",
    "Размер профиля",
    "Длина, мм",
    "Длина, м",
    "Начало (X; Y; Z)",
    "Конец (X; Y; Z)",
    "Покраска",
    "Стоимость металла",
  ]);
  styleHeaderRow(specHeader);

  for (const el of data.elementRows) {
    const row = specSheet.addRow([
      el.index,
      el.name,
      el.profileName,
      el.dimensionsLabel,
      el.lengthMm,
      el.lengthMeters,
      el.startLabel,
      el.endLabel,
      el.excludeFromPainting ? "Нет" : "Да",
      el.materialCost,
    ]);
    row.getCell(5).numFmt = "0";
    row.getCell(6).numFmt = "0.000";
    row.getCell(10).numFmt = moneyFmt;
    applyThinBorders(row, 10);
  }

  const rawBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(rawBuffer);
}
