import { roundMm } from "@/lib/geometry/elements";
import type { ConstructionElement, GridSettings, Point3D } from "@/types";

export type WorkPlane3D = "xy" | "xz" | "yz";

export type Snap3DSource = "none" | "grid" | "endpoint" | "axis";

export interface Snap3DResult {
  point: Point3D;
  snappedTo: Snap3DSource;
}

function dist3D(a: Point3D, b: Point3D): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function getPlaneAxes(plane: WorkPlane3D): readonly ["x" | "y" | "z", "x" | "y" | "z"] {
  switch (plane) {
    case "xz":
      return ["x", "z"] as const;
    case "yz":
      return ["y", "z"] as const;
    case "xy":
    default:
      return ["x", "y"] as const;
  }
}

/**
 * Привязывает 3D-точку к ближайшим вершинам конструкции, осям или шагу сетки
 * на активной рабочей плоскости (XY, XZ или YZ).
 */
export function snapPoint3D(
  rawPoint: Point3D,
  elements: ConstructionElement[],
  gridSettings: GridSettings,
  plane: WorkPlane3D,
  anchor?: Point3D,
  endpointThresholdMm = 90
): Snap3DResult {
  const cleanRaw: Point3D = {
    x: roundMm(rawPoint.x),
    y: roundMm(rawPoint.y),
    z: roundMm(rawPoint.z),
  };

  if (!gridSettings.snapEnabled) {
    return { point: cleanRaw, snappedTo: "none" };
  }

  // 1. Приоритет — привязка к существующим вершинам (концам труб) в 3D
  if (gridSettings.snapToEndpoints) {
    let bestPoint: Point3D | null = null;
    let bestDistance = endpointThresholdMm;

    for (const el of elements) {
      for (const candidate of [el.start, el.end]) {
        const d = dist3D(cleanRaw, candidate);
        if (d <= bestDistance) {
          bestDistance = d;
          bestPoint = candidate;
        }
      }
    }

    if (bestPoint) {
      return {
        point: {
          x: roundMm(bestPoint.x),
          y: roundMm(bestPoint.y),
          z: roundMm(bestPoint.z),
        },
        snappedTo: "endpoint",
      };
    }
  }

  let result: Point3D = { ...cleanRaw };
  let snappedTo: Snap3DSource = "none";
  const [axisA, axisB] = getPlaneAxes(plane);

  // 2. Привязка к шагу сетки по осям активной плоскости
  if (gridSettings.snapToGrid && gridSettings.minorStepMm > 0) {
    const step = gridSettings.minorStepMm;
    result = {
      ...result,
      [axisA]: roundMm(Math.round(result[axisA] / step) * step),
      [axisB]: roundMm(Math.round(result[axisB] / step) * step),
    };
    snappedTo = "grid";
  }

  // 3. Ортогональное/угловое выравнивание от опорной точки на текущей плоскости
  if (gridSettings.snapToAngles && anchor) {
    const da = result[axisA] - anchor[axisA];
    const db = result[axisB] - anchor[axisB];
    const len = Math.hypot(da, db);
    if (len > 1) {
      const angleDeg = (Math.atan2(db, da) * 180) / Math.PI;
      const nearest45 = Math.round(angleDeg / 45) * 45;
      if (Math.abs(angleDeg - nearest45) <= 6) {
        const rad = (nearest45 * Math.PI) / 180;
        const alignedA = roundMm(anchor[axisA] + Math.cos(rad) * len);
        const alignedB = roundMm(anchor[axisB] + Math.sin(rad) * len);
        const step = gridSettings.snapToGrid ? Math.max(1, gridSettings.minorStepMm) : 1;
        result = {
          ...result,
          [axisA]:
            Math.abs(Math.cos(rad)) < 1e-6
              ? anchor[axisA]
              : roundMm(Math.round(alignedA / step) * step),
          [axisB]:
            Math.abs(Math.sin(rad)) < 1e-6
              ? anchor[axisB]
              : roundMm(Math.round(alignedB / step) * step),
        };
        snappedTo = "axis";
      }
    }
  }

  return { point: result, snappedTo };
}

/**
 * Формирует до 4 отрезков замкнутого прямоугольника по двум противоположным 3D-углам
 * на выбранной рабочей плоскости (XY, XZ или YZ).
 */
export function buildRectangleSegments3D(
  p1: Point3D,
  p2: Point3D,
  plane: WorkPlane3D
): Array<{ start: Point3D; end: Point3D }> {
  const [axisA, axisB] = getPlaneAxes(plane);
  const thirdAxis = plane === "xy" ? "z" : plane === "xz" ? "y" : "x";
  const thirdVal = roundMm(p1[thirdAxis]);

  const a1 = roundMm(p1[axisA]);
  const b1 = roundMm(p1[axisB]);
  const a2 = roundMm(p2[axisA]);
  const b2 = roundMm(p2[axisB]);

  if (Math.abs(a2 - a1) < 1 || Math.abs(b2 - b1) < 1) {
    return [];
  }

  const makePoint = (a: number, b: number): Point3D =>
    ({
      x: 0,
      y: 0,
      z: 0,
      [axisA]: a,
      [axisB]: b,
      [thirdAxis]: thirdVal,
    }) as Point3D;

  const c1 = makePoint(a1, b1);
  const c2 = makePoint(a2, b1);
  const c3 = makePoint(a2, b2);
  const c4 = makePoint(a1, b2);

  return [
    { start: c1, end: c2 },
    { start: c2, end: c3 },
    { start: c3, end: c4 },
    { start: c4, end: c1 },
  ];
}

/** Округляет смещение вдоль оси с учётом шага сетки. */
export function snapAxisDeltaMm(
  rawDeltaMm: number,
  gridSettings: GridSettings,
  bypassSnap = false
): number {
  if (bypassSnap || !gridSettings.snapEnabled || !gridSettings.snapToGrid) {
    return roundMm(rawDeltaMm);
  }
  const step = Math.max(1, gridSettings.minorStepMm);
  return roundMm(Math.round(rawDeltaMm / step) * step);
}
