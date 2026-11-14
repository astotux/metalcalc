import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { EXAMPLE_PROFILES } from "@/features/profiles/defaults";
import { createHollowTubeGeometry } from "@/lib/geometry/beam3d";
import {
  computeElementTrims,
  getBeamOuterCorners3D,
  projectBeamPolygon2D,
  sortElementsByPlaneDepth,
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

  it("сортирует элементы по глубине вида (от дальних к ближним), чтобы передние балки перекрывали задние", () => {
    const frontBeam: ConstructionElement = {
      id: "front",
      type: "beam",
      start: { x: 0, y: 600, z: 0 },
      end: { x: 1200, y: 600, z: 0 },
      profileId: "p40",
    };
    const backBeam: ConstructionElement = {
      id: "back",
      type: "beam",
      start: { x: 0, y: 0, z: 0 },
      end: { x: 1200, y: 0, z: 0 },
      profileId: "p40",
    };
    const innerDiag: ConstructionElement = {
      id: "diag",
      type: "beam",
      start: { x: 400, y: 0, z: 0 },
      end: { x: 900, y: 600, z: 0 },
      profileId: "p40",
    };
    const profMap = new Map([[prof40.id, prof40]]);
    const els = [frontBeam, backBeam, innerDiag];
    const trims = computeElementTrims(els, [prof40]);

    // На виде спереди (XZ) глубина идёт по +Y: сначала back(0), потом diag(300), последняя front(600)
    const sortedXz = sortElementsByPlaneDepth(els, profMap, trims, "xz");
    expect(sortedXz.map((e) => e.id)).toEqual(["back", "diag", "front"]);

    // На виде сверху (XY) более высокий профиль (p60/p40) рисуется поверх более тонкого при одном Z
    const thinDiag: ConstructionElement = { ...innerDiag, profileId: "p20" };
    const prof20: MaterialProfile = { ...prof40, id: "p20", widthMm: 20, heightMm: 20 };
    const profMap2 = new Map([
      [prof40.id, prof40],
      [prof20.id, prof20],
    ]);
    const sortedXy = sortElementsByPlaneDepth([thinDiag, frontBeam], profMap2, trims, "xy");
    expect(sortedXy.map((e) => e.id)).toEqual(["diag", "front"]);
  });

  it("сращивает пологий тупой угол (~165°) без клиновидного разрыва даже при joint.type='butt' (Авто)", () => {
    const elements: ConstructionElement[] = [
      {
        id: "leg",
        type: "beam",
        start: { x: 1200, y: 0, z: 0 },
        end: { x: 1200, y: 600, z: 0 },
        profileId: "p40",
      },
      {
        id: "rafter",
        type: "beam",
        start: { x: 1200, y: 0, z: 0 },
        end: { x: 1045, y: -580, z: 0 }, // ~165° к вертикали
        profileId: "p40",
      },
    ];
    const autoJoint: JointConnection = {
      id: "j-obtuse",
      type: "butt", // detectJoints ставит 'butt' для углов != 90/45
      elementIds: ["leg", "rafter"],
      position: { x: 1200, y: 0, z: 0 },
      weldLengthMm: null,
    };

    const trims = computeElementTrims(elements, [prof40], [autoJoint]);
    const legTrim = trims.get("leg")!;
    const rafterTrim = trims.get("rafter")!;

    // Не должно быть резкого косого выреза со slope ≈ -3.5 и смещением ~80 мм
    expect(Math.abs(legTrim.start.d0Mm)).toBeLessThan(5);
    expect(Math.abs(legTrim.start.slopeX)).toBeLessThan(0.35);
    expect(Math.abs(rafterTrim.start.slopeX)).toBeLessThan(0.35);

    // Торцы двух труб в узле должны совпасть (внешние/внутренние углы у (1200, 0) сходятся)
    const legStartCorners = getBeamOuterCorners3D(elements[0], prof40, legTrim).filter(
      (c) => c.y < 100
    );
    const rafterStartCorners = getBeamOuterCorners3D(elements[1], prof40, rafterTrim).filter(
      (c) => c.y > -100
    );
    for (const lc of legStartCorners) {
      const minDist = Math.min(
        ...rafterStartCorners.map((rc) => Math.hypot(lc.x - rc.x, lc.y - rc.y, lc.z - rc.z))
      );
      expect(minDist).toBeLessThan(0.5);
    }
  });

  it("обрезает острый угол (~25°) заподлицо без торчащей за пределы узла острой «иглы»", () => {
    const chord: ConstructionElement = {
      id: "chord",
      type: "beam",
      start: { x: 0, y: 0, z: 0 },
      end: { x: 1400, y: 0, z: 0 },
      profileId: "p40",
    };
    const brace: ConstructionElement = {
      id: "brace",
      type: "beam",
      start: { x: 0, y: 0, z: 0 },
      end: { x: 1000, y: 466, z: 0 }, // ~25° к хорде
      profileId: "p40",
    };

    const trims = computeElementTrims([chord, brace], [prof40]);
    const chordCorners = getBeamOuterCorners3D(chord, prof40, trims.get("chord"));
    const braceCorners = getBeamOuterCorners3D(brace, prof40, trims.get("brace"));

    // Ни один угол ни одной балки не вытягивается в длинную иглу (-70..-90 мм): максимум ~5 мм под стык
    const minX = Math.min(...chordCorners.map((c) => c.x), ...braceCorners.map((c) => c.x));
    expect(minX).toBeGreaterThan(-10);

    // И внешний угол хорды совпадает с углом диагонали без ступеньки
    const chordBottomLeft = chordCorners.find((c) => c.x < 10 && c.y > 0)!;
    const braceLeft = braceCorners.find((c) => c.x < 10 && Math.abs(c.y - 20) < 1)!;
    expect(Math.hypot(chordBottomLeft.x - braceLeft.x, chordBottomLeft.y - braceLeft.y)).toBeLessThan(1.5);
  });

  it("подрезает 3-лучевой узел (рамная пара + третья диагональ) строго внутрь, не вытягивая диагональ наружу", () => {
    const vBeam: ConstructionElement = {
      id: "v",
      type: "beam",
      start: { x: 0, y: 0, z: 0 },
      end: { x: 0, y: 600, z: 0 },
      profileId: "p40",
    };
    const pBeam: ConstructionElement = {
      id: "p",
      type: "beam",
      start: { x: 0, y: 0, z: 0 },
      end: { x: 1150, y: -350, z: 0 },
      profileId: "p40",
    };
    const diag: ConstructionElement = {
      id: "d",
      type: "beam",
      start: { x: 0, y: 0, z: 0 },
      end: { x: 900, y: -900, z: 0 },
      profileId: "p40",
    };

    const trims = computeElementTrims([vBeam, pBeam, diag], [prof40]);
    const diagTrim = trims.get("d")!;
    // Начало диагонали в (0,0) должно укорачиваться внутрь балки (d0Mm >= 0), не удлиняться в минус
    expect(diagTrim.start.d0Mm).toBeGreaterThanOrEqual(0);
  });

  it("подрезает Т-примыкание вблизи конца длинной балки (30 мм от края при длине 2500 мм)", () => {
    const host: ConstructionElement = {
      id: "host-long",
      type: "beam",
      start: { x: 0, y: 0, z: 0 },
      end: { x: 2500, y: 0, z: 0 },
      profileId: "p40",
    };
    const branch: ConstructionElement = {
      id: "branch-near-end",
      type: "beam",
      start: { x: 30, y: 0, z: 0 },
      end: { x: 30, y: 500, z: 0 },
      profileId: "p40",
    };

    const trims = computeElementTrims([host, branch], [prof40]);
    expect(trims.get("branch-near-end")?.start.d0Mm).toBeCloseTo(20, 3);
  });
});
