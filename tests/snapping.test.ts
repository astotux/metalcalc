import { describe, expect, it } from "vitest";
import { DEFAULT_GRID_SETTINGS } from "@/features/projects/defaults";
import {
  findSegmentIntersection2D,
  getAllIntersections2D,
  getSnapPoint,
  isElementInSelectionRect,
} from "@/lib/geometry/snapping";
import type { ConstructionElement } from "@/types";

const sampleElements: ConstructionElement[] = [
  {
    id: "e1",
    type: "beam",
    start: { x: 0, y: 0, z: 0 },
    end: { x: 1000, y: 0, z: 0 },
    profileId: "prof-40x40x2",
  },
  {
    id: "e2",
    type: "beam",
    start: { x: 500, y: -300, z: 0 },
    end: { x: 500, y: 300, z: 0 },
    profileId: "prof-40x40x2",
  },
];

describe("Привязки и пересечения 2D-редактора", () => {
  it("находит точку пересечения двух отрезков", () => {
    const hit = findSegmentIntersection2D(
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 500, y: -300 },
      { x: 500, y: 300 }
    );
    expect(hit).toEqual({ x: 500, y: 0 });
    expect(getAllIntersections2D(sampleElements)).toEqual([{ x: 500, y: 0 }]);
  });

  it("приоритетно привязывается к концам линий", () => {
    const snap = getSnapPoint({ x: 1012, y: 8 }, sampleElements, DEFAULT_GRID_SETTINGS, {
      snapRadiusMm: 25,
    });
    expect(snap.snapType).toBe("endpoint");
    expect(snap.point).toEqual({ x: 1000, y: 0 });
  });

  it("привязывается к пересечению элементов", () => {
    const snap = getSnapPoint({ x: 508, y: -6 }, sampleElements, DEFAULT_GRID_SETTINGS, {
      snapRadiusMm: 25,
    });
    expect(snap.snapType).toBe("intersection");
    expect(snap.point).toEqual({ x: 500, y: 0 });
  });

  it("привязывается к углам (шаг 45°) относительно опорной точки", () => {
    const snap = getSnapPoint({ x: 405, y: 392 }, [], DEFAULT_GRID_SETTINGS, {
      anchorMm: { x: 0, y: 0 },
      snapRadiusMm: 20,
    });
    expect(snap.snapType).toBe("angle");
    expect(snap.angleDeg).toBe(45);
  });

  it("привязывается к мелкой сетке и отключает привязку при snapEnabled=false", () => {
    const snapped = getSnapPoint({ x: 237, y: 368 }, [], DEFAULT_GRID_SETTINGS);
    expect(snapped.snapType).toBe("grid");
    expect(snapped.point).toEqual({ x: 200, y: 400 });

    const free = getSnapPoint(
      { x: 237.45, y: 368.12 },
      [],
      { ...DEFAULT_GRID_SETTINGS, snapEnabled: false }
    );
    expect(free.snapType).toBe("none");
    expect(free.point).toEqual({ x: 237.45, y: 368.12 });
  });

  it("корректно определяет попадание элемента в рамку выделения", () => {
    expect(
      isElementInSelectionRect(sampleElements[0], { x1: 200, y1: -50, x2: 700, y2: 50 })
    ).toBe(true);
    expect(
      isElementInSelectionRect(sampleElements[0], { x1: 200, y1: 100, x2: 700, y2: 300 })
    ).toBe(false);
  });
});
