import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { createEmptyProject, createExampleProject } from "@/features/projects/defaults";
import { calculateProjectEstimate } from "@/lib/calculations/estimate";
import { buildExportFileName, buildProjectExportData } from "@/lib/export/buildExportSummary";
import { generateExcelBuffer } from "@/lib/export/excelGenerator";
import { generatePdfBuffer } from "@/lib/export/pdfGenerator";

describe("Export module (Excel & PDF)", () => {
  it("builds complete export summary with bounds and element specification", () => {
    const project = createExampleProject();
    const data = buildProjectExportData(project);

    expect(data.projectName).toBe(project.name);
    expect(data.materialRows.length).toBeGreaterThan(0);
    expect(data.elementRows.length).toBe(project.elements.length);
    expect(data.boundsMm.widthMm).toBe(1200);
    expect(data.boundsMm.heightMm).toBe(600);
    expect(buildExportFileName('Навес "6x4" / тест', "pdf")).toBe("Навес_6x4_тест_smeta.pdf");
  });

  it("generates valid Excel (.xlsx) workbook with required columns and totals", async () => {
    const project = createExampleProject();
    const estimate = calculateProjectEstimate(
      project.elements,
      project.profiles,
      project.joints,
      project.calculationSettings
    );

    const buffer = await generateExcelBuffer(project);
    expect(buffer.length).toBeGreaterThan(1000);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    const estimateSheet = workbook.getWorksheet("Смета и материалы");
    const specSheet = workbook.getWorksheet("Спецификация элементов");
    expect(estimateSheet).toBeDefined();
    expect(specSheet).toBeDefined();

    // Проверяем обязательные столбцы таблицы материалов (строка 4)
    const headerValues = estimateSheet!.getRow(4).values as unknown[];
    expect(headerValues).toContain("Название материала");
    expect(headerValues).toContain("Размер профиля");
    expect(headerValues).toContain("Толщина стенки, мм");
    expect(headerValues).toContain("Общая длина, м");
    expect(headerValues).toContain("Цена за метр");
    expect(headerValues).toContain("Стоимость");

    // Проверяем наличие покраски, сварки и точной итоговой суммы
    const allTexts: string[] = [];
    let foundGrandTotal = false;
    estimateSheet!.eachRow((row) => {
      const label = String(row.getCell(1).value ?? "");
      allTexts.push(label);
      if (label === "ИТОГОВАЯ СУММА") {
        foundGrandTotal = Number(row.getCell(7).value) === estimate.totalCost;
      }
    });

    expect(allTexts).toContain("Покраска конструкции");
    expect(allTexts).toContain("Сварочные работы");
    expect(foundGrandTotal).toBe(true);
    expect(specSheet!.rowCount).toBe(1 + project.elements.length);
  });

  it("generates valid PDF buffer with Cyrillic content for example and empty projects", async () => {
    const examplePdf = await generatePdfBuffer(createExampleProject());
    expect(examplePdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(examplePdf.length).toBeGreaterThan(2000);

    const emptyPdf = await generatePdfBuffer(createEmptyProject("Пустой проект"));
    expect(emptyPdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(emptyPdf.length).toBeGreaterThan(1000);
  });
});
