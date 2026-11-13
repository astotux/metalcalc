import { roundMm } from "@/lib/geometry/elements";
import type { ConstructionElement, GridSettings, Point2D, Point3D } from "@/types";

export type OrthoPlane = "xy" | "xz" | "yz";
export type SnapType = "endpoint" | "intersection" | "angle" | "grid" | "none";

export interface SnapResult {
  point: Point2D;
  snapType: SnapType;
  /** Угол в градусах при привязке к углу или линии. */
  angleDeg?: number;
}

export interface PlaneSnapResult extends SnapResult {
  /** Исходная 3D-точка при привязке к существующей вершине конструкции. */
  sourcePoint3D?: Point3D;
}

/** Проецирует 3D-точку на выбранную ортогональную 2D-плоскость (XY, XZ или YZ). */
export function projectPoint3DToPlane2D(point: Point3D, plane: OrthoPlane): Point2D {
  switch (plane) {
    case "xz":
      return { x: point.x, y: point.z };
    case "yz":
      return { x: point.y, y: point.z };
    case "xy":
    default:
      return { x: point.x, y: point.y };
  }
}

/** Преобразует 2D-координаты плоскости (u, v) обратно в 3D-точку с заданной глубиной третьей оси. */
export function planeCoordsToPoint3D(
  u: number,
  v: number,
  plane: OrthoPlane,
  thirdCoordMm = 0
): Point3D {
  switch (plane) {
    case "xz":
      return { x: roundMm(u), y: roundMm(thirdCoordMm), z: roundMm(v) };
    case "yz":
      return { x: roundMm(thirdCoordMm), y: roundMm(u), z: roundMm(v) };
    case "xy":
    default:
      return { x: roundMm(u), y: roundMm(v), z: roundMm(thirdCoordMm) };
  }
}

/** Возвращает координату точки по оси, перпендикулярной заданной ортогональной плоскости. */
export function getThirdCoord3D(point: Point3D, plane: OrthoPlane): number {
  switch (plane) {
    case "xz":
      return point.y;
    case "yz":
      return point.x;
    case "xy":
    default:
      return point.z;
  }
}

/** Преобразует 2D-смещение (du, dv) на ортогональной плоскости в 3D-смещение. */
export function delta2DToDelta3D(du: number, dv: number, plane: OrthoPlane): Point3D {
  switch (plane) {
    case "xz":
      return { x: roundMm(du), y: 0, z: roundMm(dv) };
    case "yz":
      return { x: 0, y: roundMm(du), z: roundMm(dv) };
    case "xy":
    default:
      return { x: roundMm(du), y: roundMm(dv), z: 0 };
  }
}

/** Находит точку пересечения двух отрезков AB и CD в 2D, если они пересекаются. */
export function findSegmentIntersection2D(
  a: Point2D,
  b: Point2D,
  c: Point2D,
  d: Point2D
): Point2D | null {
  const denom = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(denom) < 1e-6) return null;

  const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denom;
  const u = -((a.x - b.x) * (a.y - c.y) - (a.y - b.y) * (a.x - c.x)) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: roundMm(a.x + t * (b.x - a.x)),
      y: roundMm(a.y + t * (b.y - a.y)),
    };
  }
  return null;
}

/** Вычисляет все внутренние и узловые пересечения между элементами конструкции в 2D. */
export function getAllIntersections2D(elements: ConstructionElement[]): Point2D[] {
  const points: Point2D[] = [];
  for (let i = 0; i < elements.length; i += 1) {
    for (let j = i + 1; j < elements.length; j += 1) {
      const hit = findSegmentIntersection2D(
        elements[i].start,
        elements[i].end,
        elements[j].start,
        elements[j].end
      );
      if (hit) {
        points.push(hit);
      }
    }
  }
  return points;
}

/** Расстояние от точки P до отрезка AB в 2D (в мм). */
export function distancePointToSegment2D(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Проверяет, попадает ли отрезок AB (или его часть) в прямоугольник выделения. */
export function isElementInSelectionRect(
  el: { start: Point2D; end: Point2D },
  rect: { x1: number; y1: number; x2: number; y2: number }
): boolean {
  const minX = Math.min(rect.x1, rect.x2);
  const maxX = Math.max(rect.x1, rect.x2);
  const minY = Math.min(rect.y1, rect.y2);
  const maxY = Math.max(rect.y1, rect.y2);

  const inside = (p: Point2D) =>
    p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;

  if (inside(el.start) || inside(el.end)) return true;

  // Проверка пересечения диагоналей/рёбер рамки с отрезком
  const corners: [Point2D, Point2D][] = [
    [{ x: minX, y: minY }, { x: maxX, y: minY }],
    [{ x: maxX, y: minY }, { x: maxX, y: maxY }],
    [{ x: maxX, y: maxY }, { x: minX, y: maxY }],
    [{ x: minX, y: maxY }, { x: minX, y: minY }],
  ];
  return corners.some(([c1, c2]) => findSegmentIntersection2D(el.start, el.end, c1, c2) !== null);
}

/**
 * Вычисляет привязанную точку в миллиметрах с учётом приоритетов CAD:
 * 1. Концы линий
 * 2. Пересечения элементов
 * 3. Угловая привязка относительно опорной точки (шаг 45°) + сетка
 * 4. Сетка (minorStepMm)
 */
export function getSnapPoint(
  rawWorldMm: Point2D,
  elements: ConstructionElement[],
  gridSettings: GridSettings,
  options?: {
    anchorMm?: Point2D | null;
    snapRadiusMm?: number;
    excludeElementIds?: Set<string>;
  }
): SnapResult {
  if (!gridSettings.snapEnabled) {
    return {
      point: { x: roundMm(rawWorldMm.x), y: roundMm(rawWorldMm.y) },
      snapType: "none",
    };
  }

  const snapRadiusMm = options?.snapRadiusMm ?? 45;
  const excludeIds = options?.excludeElementIds;

  // 1. Привязка к концам элементов
  if (gridSettings.snapToEndpoints) {
    let bestPoint: Point2D | null = null;
    let bestDist = snapRadiusMm;

    for (const el of elements) {
      if (excludeIds?.has(el.id)) continue;
      for (const candidate of [el.start, el.end]) {
        const d = Math.hypot(rawWorldMm.x - candidate.x, rawWorldMm.y - candidate.y);
        if (d <= bestDist) {
          bestDist = d;
          bestPoint = { x: candidate.x, y: candidate.y };
        }
      }
    }

    if (bestPoint) {
      return { point: bestPoint, snapType: "endpoint" };
    }
  }

  // 2. Привязка к пересечениям
  if (gridSettings.snapToIntersections) {
    const filtered = excludeIds
      ? elements.filter((el) => !excludeIds.has(el.id))
      : elements;
    const intersections = getAllIntersections2D(filtered);
    let bestPoint: Point2D | null = null;
    let bestDist = snapRadiusMm;

    for (const inter of intersections) {
      const d = Math.hypot(rawWorldMm.x - inter.x, rawWorldMm.y - inter.y);
      if (d <= bestDist) {
        bestDist = d;
        bestPoint = inter;
      }
    }

    if (bestPoint) {
      return { point: bestPoint, snapType: "intersection" };
    }
  }

  // 3. Привязка к углам (шаг 45°) относительно опорной точки при черчении
  const anchor = options?.anchorMm;
  if (gridSettings.snapToAngles && anchor) {
    const dx = rawWorldMm.x - anchor.x;
    const dy = rawWorldMm.y - anchor.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 5) {
      const rawAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      const snappedAngleDeg = Math.round(rawAngleDeg / 45) * 45;
      const angleDiff = Math.abs(rawAngleDeg - snappedAngleDeg);

      // Если курсор в пределах ±6° от ортогонального или 45° луча
      if (angleDiff <= 6) {
        const rad = (snappedAngleDeg * Math.PI) / 180;
        const step = gridSettings.snapToGrid ? Math.max(1, gridSettings.minorStepMm) : 1;
        const snappedDist = gridSettings.snapToGrid
          ? Math.max(step, Math.round(dist / step) * step)
          : dist;

        return {
          point: {
            x: roundMm(anchor.x + Math.cos(rad) * snappedDist),
            y: roundMm(anchor.y + Math.sin(rad) * snappedDist),
          },
          snapType: "angle",
          angleDeg: ((snappedAngleDeg % 360) + 360) % 360,
        };
      }
    }
  }

  // 4. Привязка к мелкой сетке
  if (gridSettings.snapToGrid) {
    const step = Math.max(1, gridSettings.minorStepMm);
    return {
      point: {
        x: Math.round(rawWorldMm.x / step) * step,
        y: Math.round(rawWorldMm.y / step) * step,
      },
      snapType: "grid",
    };
  }

  return {
    point: { x: roundMm(rawWorldMm.x), y: roundMm(rawWorldMm.y) },
    snapType: "none",
  };
}

/** Вычисляет все пересечения проекций элементов на заданной ортогональной плоскости (XY, XZ, YZ). */
export function getAllIntersectionsOnPlane(
  elements: ConstructionElement[],
  plane: OrthoPlane
): Point2D[] {
  if (plane === "xy") return getAllIntersections2D(elements);

  const projected = elements.map((el) => ({
    a: projectPoint3DToPlane2D(el.start, plane),
    b: projectPoint3DToPlane2D(el.end, plane),
  }));

  const points: Point2D[] = [];
  for (let i = 0; i < projected.length; i += 1) {
    for (let j = i + 1; j < projected.length; j += 1) {
      const hit = findSegmentIntersection2D(
        projected[i].a,
        projected[i].b,
        projected[j].a,
        projected[j].b
      );
      if (hit) points.push(hit);
    }
  }
  return points;
}

/** Проверяет, попадает ли проекция элемента на заданную плоскость в рамку выделения. */
export function isElementInSelectionRectOnPlane(
  el: Pick<ConstructionElement, "start" | "end">,
  rect: { x1: number; y1: number; x2: number; y2: number },
  plane: OrthoPlane
): boolean {
  return isElementInSelectionRect(
    {
      start: projectPoint3DToPlane2D(el.start, plane),
      end: projectPoint3DToPlane2D(el.end, plane),
    },
    rect
  );
}

/**
 * Привязывает 2D-курсор на заданной ортогональной проекции (XY, XZ или YZ)
 * к концам элементов (с сохранением реальной 3D-координаты вершины), пересечениям,
 * углам кратным 45° и мелкой сетке.
 */
export function getSnapPointOnPlane(
  rawPlaneMm: Point2D,
  elements: ConstructionElement[],
  gridSettings: GridSettings,
  plane: OrthoPlane,
  options?: {
    anchorMm?: Point2D | null;
    preferredThirdCoordMm?: number;
    snapRadiusMm?: number;
    excludeElementIds?: Set<string>;
  }
): PlaneSnapResult {
  if (!gridSettings.snapEnabled) {
    return {
      point: { x: roundMm(rawPlaneMm.x), y: roundMm(rawPlaneMm.y) },
      snapType: "none",
    };
  }

  const snapRadiusMm = options?.snapRadiusMm ?? 45;
  const excludeIds = options?.excludeElementIds;
  const preferredThird = options?.preferredThirdCoordMm ?? 0;

  // 1. Привязка к вершинам элементов на проекции (с выбором лучшего совпадения по глубине)
  if (gridSettings.snapToEndpoints) {
    let bestPoint: Point2D | null = null;
    let bestSource3D: Point3D | undefined;
    let bestDist = snapRadiusMm;
    let bestThirdDiff = Infinity;

    for (const el of elements) {
      if (excludeIds?.has(el.id)) continue;
      for (const candidate3D of [el.start, el.end]) {
        const candidate2D = projectPoint3DToPlane2D(candidate3D, plane);
        const d = Math.hypot(rawPlaneMm.x - candidate2D.x, rawPlaneMm.y - candidate2D.y);
        const thirdDiff = Math.abs(getThirdCoord3D(candidate3D, plane) - preferredThird);

        const isCloser = d < bestDist - 1e-3;
        const isTieCloserDepth = Math.abs(d - bestDist) <= 1e-3 && thirdDiff < bestThirdDiff;

        if ((d <= snapRadiusMm && bestPoint === null) || isCloser || isTieCloserDepth) {
          bestDist = d;
          bestThirdDiff = thirdDiff;
          bestPoint = { x: candidate2D.x, y: candidate2D.y };
          bestSource3D = { ...candidate3D };
        }
      }
    }

    if (bestPoint) {
      return {
        point: bestPoint,
        snapType: "endpoint",
        sourcePoint3D: bestSource3D,
      };
    }
  }

  // 2. Пересечения проекций на плоскости
  if (gridSettings.snapToIntersections) {
    const filtered = excludeIds
      ? elements.filter((el) => !excludeIds.has(el.id))
      : elements;
    const intersections = getAllIntersectionsOnPlane(filtered, plane);
    let bestPoint: Point2D | null = null;
    let bestDist = snapRadiusMm;

    for (const inter of intersections) {
      const d = Math.hypot(rawPlaneMm.x - inter.x, rawPlaneMm.y - inter.y);
      if (d <= bestDist) {
        bestDist = d;
        bestPoint = inter;
      }
    }

    if (bestPoint) {
      return { point: bestPoint, snapType: "intersection" };
    }
  }

  // 3. Ортогональная/диагональная привязка к углам (шаг 45°)
  const anchor = options?.anchorMm;
  if (gridSettings.snapToAngles && anchor) {
    const dx = rawPlaneMm.x - anchor.x;
    const dy = rawPlaneMm.y - anchor.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 5) {
      const rawAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      const snappedAngleDeg = Math.round(rawAngleDeg / 45) * 45;
      const angleDiff = Math.abs(rawAngleDeg - snappedAngleDeg);

      if (angleDiff <= 6) {
        const rad = (snappedAngleDeg * Math.PI) / 180;
        const step = gridSettings.snapToGrid ? Math.max(1, gridSettings.minorStepMm) : 1;
        const snappedDist = gridSettings.snapToGrid
          ? Math.max(step, Math.round(dist / step) * step)
          : dist;

        return {
          point: {
            x: roundMm(anchor.x + Math.cos(rad) * snappedDist),
            y: roundMm(anchor.y + Math.sin(rad) * snappedDist),
          },
          snapType: "angle",
          angleDeg: ((snappedAngleDeg % 360) + 360) % 360,
        };
      }
    }
  }

  // 4. Мелкая сетка
  if (gridSettings.snapToGrid) {
    const step = Math.max(1, gridSettings.minorStepMm);
    return {
      point: {
        x: Math.round(rawPlaneMm.x / step) * step,
        y: Math.round(rawPlaneMm.y / step) * step,
      },
      snapType: "grid",
    };
  }

  return {
    point: { x: roundMm(rawPlaneMm.x), y: roundMm(rawPlaneMm.y) },
    snapType: "none",
  };
}
