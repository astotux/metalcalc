import { describe, expect, it } from "vitest";
import {
  detectProjectJoints,
  estimateJointPerimeterWeldMm,
} from "@/features/joints/detectJoints";
import { EXAMPLE_PROFILES } from "@/features/profiles/defaults";
import type { ConstructionElement, JointConnection } from "@/types";

describe("Модуль соединений конструкций", () => {
  it("распознаёт углы 90°, 45°, Т-образные и нахлёстные стыки", () => {
    const elements: ConstructionElement[] = [
      // Горизонтальная балка 0..1000
      {
        id: "b1",
        type: "beam",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1000, y: 0, z: 0 },
        profileId: "prof-40x40x2",
      },
      // Вертикальная балка под 90° в точке (0, 0)
      {
        id: "b2",
        type: "beam",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 0, y: 600, z: 0 },
        profileId: "prof-40x40x2",
      },
      // Диагональная балка под 45° в точке (1000, 0)
      {
        id: "b3",
        type: "beam",
        start: { x: 1000, y: 0, z: 0 },
        end: { x: 1400, y: 400, z: 0 },
        profileId: "prof-40x20x2",
      },
      // Т-образная стойка к середине b1 в точке (500, 0)
      {
        id: "b4",
        type: "beam",
        start: { x: 500, y: 0, z: 0 },
        end: { x: 500, y: 500, z: 0 },
        profileId: "prof-40x20x2",
      },
      // Балка внахлёст, пересекающая b4 в точке (500, 250)
      {
        id: "b5",
        type: "beam",
        start: { x: 200, y: 250, z: 0 },
        end: { x: 800, y: 250, z: 0 },
        profileId: "prof-20x20x1_5",
      },
    ];

    const joints = detectProjectJoints(elements);

    const j90 = joints.find((j) => j.elementIds.includes("b1") && j.elementIds.includes("b2"));
    expect(j90?.type).toBe("miter_90");
    expect(j90?.cutAngleDeg).toBe(45);
    expect(j90?.weldLengthMm).toBeNull();

    const j45 = joints.find((j) => j.elementIds.includes("b1") && j.elementIds.includes("b3"));
    expect(j45?.type).toBe("miter_45");

    const jT = joints.find((j) => j.elementIds.includes("b1") && j.elementIds.includes("b4"));
    expect(jT?.type).toBe("t_joint");

    const jLap = joints.find((j) => j.elementIds.includes("b4") && j.elementIds.includes("b5"));
    expect(jLap?.type).toBe("lap");
  });

  it("сохраняет ручную длину сварного шва при повторном поиске стыков и оценивает периметр", () => {
    const elements: ConstructionElement[] = [
      {
        id: "b1",
        type: "beam",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1000, y: 0, z: 0 },
        profileId: "prof-40x40x2",
      },
      {
        id: "b2",
        type: "beam",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 0, y: 500, z: 0 },
        profileId: "prof-40x20x2",
      },
    ];

    const existing: JointConnection[] = [
      {
        id: "manual-j1",
        type: "miter_90",
        elementIds: ["b1", "b2"],
        position: { x: 0, y: 0, z: 0 },
        weldLengthMm: 185,
        processingNotes: "Двойной проход",
      },
    ];

    const synced = detectProjectJoints(elements, existing);
    expect(synced).toHaveLength(1);
    expect(synced[0].id).toBe("manual-j1");
    expect(synced[0].weldLengthMm).toBe(185);
    expect(synced[0].processingNotes).toBe("Двойной проход");

    // Оценка периметра меньшего профиля 40×20 -> 2 * (40 + 20) = 120 мм
    const estimated = estimateJointPerimeterWeldMm(synced[0], elements, EXAMPLE_PROFILES);
    expect(estimated).toBe(120);
  });
});
