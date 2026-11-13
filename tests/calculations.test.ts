import { describe, expect, it } from "vitest";
import { EXAMPLE_PROFILES } from "@/features/profiles/defaults";
import { DEFAULT_CALCULATION_SETTINGS } from "@/features/projects/defaults";
import { calculateProjectEstimate, roundMoney } from "@/lib/calculations/estimate";
import { getElementLengthMm, resizeElementEndByLength } from "@/lib/geometry/elements";
import type { ConstructionElement, JointConnection } from "@/types";

describe("Геометрия элементов", () => {
  it("вычисляет точную длину элемента в миллиметрах", () => {
    const el: ConstructionElement = {
      id: "1",
      type: "beam",
      start: { x: 0, y: 0, z: 0 },
      end: { x: 300, y: 400, z: 0 },
      profileId: "prof-40x40x2",
    };
    expect(getElementLengthMm(el)).toBe(500);
  });

  it("корректно изменяет длину элемента с сохранением направления", () => {
    const el: ConstructionElement = {
      id: "1",
      type: "beam",
      start: { x: 100, y: 200, z: 0 },
      end: { x: 400, y: 600, z: 0 },
      profileId: "prof-40x40x2",
    };
    const nextEnd = resizeElementEndByLength(el, 1000);
    expect(nextEnd).toEqual({ x: 700, y: 1000, z: 0 });
  });
});

describe("Расчётное ядро сметы", () => {
  it("рассчитывает стоимость металла, покраски (с исключением) и сварки", () => {
    const elements: ConstructionElement[] = [
      {
        id: "e1",
        type: "beam",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 5000, y: 0, z: 0 },
        profileId: "prof-40x40x2", // 450 руб/м -> 5 * 450 = 2250
      },
      {
        id: "e2",
        type: "beam",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 3000, y: 0, z: 0 },
        profileId: "prof-60x30x2", // 500 руб/м -> 3 * 500 = 1500
        excludeFromPainting: true,
      },
    ];

    const joints: JointConnection[] = [
      {
        id: "j1",
        type: "miter_90",
        elementIds: ["e1", "e2"],
        position: { x: 0, y: 0, z: 0 },
        weldLengthMm: 200,
      },
    ];

    const estimate = calculateProjectEstimate(elements, EXAMPLE_PROFILES, joints, {
      ...DEFAULT_CALCULATION_SETTINGS,
      paintingPricePerMeter: 100,
      weldPricingMode: "per_joint",
      weldPricePerJoint: 150,
    });

    expect(estimate.totalLengthMeters).toBe(8);
    expect(estimate.paintableLengthMeters).toBe(5);
    expect(estimate.metalCost).toBe(3750);
    expect(estimate.paintingCost).toBe(500);
    expect(estimate.weldingCost).toBe(150);
    expect(estimate.totalCost).toBe(4400);
  });

  it("не приравнивает неизвестную длину шва к длине трубы", () => {
    const elements: ConstructionElement[] = [
      {
        id: "e1",
        type: "beam",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 2000, y: 0, z: 0 },
        profileId: "prof-40x40x2",
      },
    ];
    const joints: JointConnection[] = [
      {
        id: "j1",
        type: "butt",
        elementIds: ["e1"],
        position: { x: 0, y: 0, z: 0 },
        weldLengthMm: null,
      },
    ];

    const estimate = calculateProjectEstimate(elements, EXAMPLE_PROFILES, joints, {
      ...DEFAULT_CALCULATION_SETTINGS,
      weldPricingMode: "per_meter",
      weldPricePerMeter: 600,
    });

    expect(estimate.knownWeldLengthMeters).toBe(0);
    expect(estimate.hasUnknownWeldLength).toBe(true);
    expect(estimate.weldingCost).toBe(0);
    expect(roundMoney(10.005)).toBe(10.01);
  });
});
