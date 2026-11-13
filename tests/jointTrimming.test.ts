import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { EXAMPLE_PROFILES } from "@/features/profiles/defaults";
import { createHollowTubeGeometry } from "@/lib/geometry/beam3d";
import {
  computeElementTrims,
  getBeamOuterCorners3D,
  projectBeamPolygon2D,
} from "@/lib/geometry/jointTrimming";
import type { ConstructionElement, JointConnection, MaterialProfile } from "@/types";

const prof40: MaterialProfile = {
  ...EXAMPLE_PROFILES[2],
  id: "p40",
  widthMm: 40,
  heightMm: 40,
  wallThicknessMm: 2,
};

const prof60x40: MaterialProfile = {
  ...EXAMPLE_PROFILES[3],
  id: "p60x40",
  widthMm: 60,
  heightMm: 40,
  wallThicknessMm: 2,
};

describe("Сращивание и подрезка угловых стыков (2D / 3D)", () => {
  it("сращивает угол 90° двух одинаковых труб 40×40 на ус (45°) без зазоров", () => {
    const elements: ConstructionElement[] = [
      {
        id: "b1",
        type: "beam",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1000, y: 0, z: 0 },
        profileId: "p40",
      },
      {
        id: "b2",
        type: "beam",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 0, y: 800, z: 0 },
        profileId: "p40",
      },
    ];

    const trims = computeElementTrims(elements, [prof40]);
    const corners1 = getBeamOuterCorners3D(elements[0], prof40, trims.get("b1"));
    const corners2 = getBeamOuterCorners3D(elements[1], prof40, trims.get("b2"));

    // Обе трубы должны доходить внешним углом ровно до (-20, -20)
    const hasOuter1 = corners1.some((c) => Math.abs(c.x - -20) < 0.01 && Math.abs(c.y - -20) < 0.01);
    const hasOuter2 = corners2.some((c) => Math.abs(c.x - -20) < 0.01 && Math.abs(c.y - -20) < 0.01);
    expect(hasOuter1).toBe(true);
    expect(hasOuter2).toBe(true);

    // И обе трубы должны иметь общую внутреннюю вершину (+20, +20)
    const hasInner1 = corners1.some((c) => Math.abs(c.x - 20) < 0.01 && Math.abs(c.y - 20) < 0.01);
    const hasInner2 = corners2.some((c) => Math.abs(c.x - 20) < 0.01 && Math.abs(c.y - 20) < 0.01);
    expect(hasInner1).toBe(true);
    expect(hasInner2).toBe(true);

    // 2D-полигон в XY содержит точку (-20, -20)
    const poly1 = projectBeamPolygon2D(elements[0], prof40, trims.get("b1"), "xy");
    expect(poly1.some((p) => Math.abs(p.x - -20) < 0.01 && Math.abs(p.y - -20) < 0.01)).toBe(true);
  });

  it("стыкует под 90° трубы разной ширины (60×40 и 40×40) точка-в-точку", () => {
    const elements: ConstructionElement[] = [
      {
        id: "wide",
        type: "beam",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1000, y: 0, z: 0 },
        profileId: "p60x40",
      },
      {
        id: "narrow",
        type: "beam",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 0, y: 800, z: 0 },
        profileId: "p40",
      },
    ];

    const trims = computeElementTrims(elements, [prof60x40, prof40]);
    const cornersWide = getBeamOuterCorners3D(elements[0], prof60x40, trims.get("wide"));
    const cornersNarrow = getBeamOuterCorners3D(elements[1], prof40, trims.get("narrow"));

    // Внешний угол пересечения: x = -20 (половина narrow), y = -30 (половина wide)
    expect(
      cornersWide.some((c) => Math.abs(c.x - -20) < 0.01 && Math.abs(c.y - -30) < 0.01)
    ).toBe(true);
    expect(
      cornersNarrow.some((c) => Math.abs(c.x - -20) < 0.01 && Math.abs(c.y - -30) < 0.01)
    ).toBe(true);
  });

  it("выполняет стык встык (butt) с продлением проходной и укорочением примыкающей трубы", () => {
    const elements: ConstructionElement[] = [
      {
        id: "e1",
        type: "beam",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1000, y: 0, z: 0 },
        profileId: "p40",
      },
      {
        id: "e2",
        type: "beam",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 0, y: 800, z: 0 },
        profileId: "p40",
      },
    ];
    const joints: JointConnection[] = [
      {
        id: "j1",
        type: "butt",
        elementIds: ["e1", "e2"],
        position: { x: 0, y: 0, z: 0 },
        weldLengthMm: null,
        trimMode: "butt",
        primaryElementId: "e1",
      },
    ];

    const trims = computeElementTrims(elements, [prof40], joints);
    expect(trims.get("e1")?.start.d0Mm).toBeCloseTo(-20, 3);
    expect(trims.get("e1")?.start.slopeX).toBeCloseTo(0, 3);
    expect(trims.get("e2")?.start.d0Mm).toBeCloseTo(20, 3);
    expect(trims.get("e2")?.start.slopeX).toBeCloseTo(0, 3);
  });

  it("сращивает 3D-узел (2 горизонтальные рамы + вертикальная стойка) без выпирания", () => {
    const elements: ConstructionElement[] = [
      {
        id: "rx",
        type: "beam",
        start: { x: 0, y: 0, z: 750 },
        end: { x: 1000, y: 0, z: 750 },
        profileId: "p40",
      },
      {
        id: "ry",
        type: "beam",
        start: { x: 0, y: 0, z: 750 },
        end: { x: 0, y: 600, z: 750 },
        profileId: "p40",
      },
      {
        id: "leg",
        type: "beam",
        start: { x: 0, y: 0, z: 750 },
        end: { x: 0, y: 0, z: 0 },
        profileId: "p40",
      },
    ];

    const trims = computeElementTrims(elements, [prof40]);
    const legTrim = trims.get("leg");
    // Стойка идёт от z=750 вниз к z=0 -> должна укоротиться от z=750 на 20 мм вниз (до z=730)
    expect(legTrim?.start.d0Mm).toBeCloseTo(20, 3);
    const legCorners = getBeamOuterCorners3D(elements[2], prof40, legTrim);
    const maxZ = Math.max(...legCorners.map((c) => c.z));
    expect(maxZ).toBeCloseTo(730, 2);
  });

  it("подрезает Т-образное примыкание ровно до стенки несущей трубы", () => {
    const elements: ConstructionElement[] = [
      {
        id: "host",
        type: "beam",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1000, y: 0, z: 0 },
        profileId: "p40",
      },
      {
        id: "branch",
        type: "beam",
        start: { x: 500, y: 0, z: 0 },
        end: { x: 500, y: 600, z: 0 },
        profileId: "p40",
      },
    ];

    const trims = computeElementTrims(elements, [prof40]);
    expect(trims.get("branch")?.start.d0Mm).toBeCloseTo(20, 3);
    expect(trims.get("host")?.start.d0Mm).toBeCloseTo(0, 3);
  });

  it("строит 3D BufferGeometry полой трубы с корректным скосом торца", () => {
    const elements: ConstructionElement[] = [
      {
        id: "b1",
        type: "beam",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1000, y: 0, z: 0 },
        profileId: "p40",
      },
      {
        id: "b2",
        type: "beam",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 0, y: 800, z: 0 },
        profileId: "p40",
      },
    ];

    const trims = computeElementTrims(elements, [prof40]);
    const geometry = createHollowTubeGeometry(prof40, 1.0, trims.get("b1"));
    geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    geometry.boundingBox?.getSize(size);

    // Обычная длина 1.0м + удлинение внешней кромки на +0.02м
    expect(size.z).toBeCloseTo(1.02, 4);
    expect(size.x).toBeCloseTo(0.04, 4);
    expect(size.y).toBeCloseTo(0.04, 4);
    geometry.dispose();
  });
});
