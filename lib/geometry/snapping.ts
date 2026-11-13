import { roundMm } from "@/lib/geometry/elements";
import type { ConstructionElement, GridSettings, Point2D } from "@/types";

export type SnapType = "endpoint" | "intersection" | "angle" | "grid" | "none";

export interface SnapResult {
  point: Point2D;
  snapType: SnapType;
  /** Угол в градусах при привязке к углу или линии. */
  angleDeg?: number;
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
  el: Pick<ConstructionElement, "start" | "end">,
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
