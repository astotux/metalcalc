import { findSegmentIntersection2D } from "@/lib/geometry/snapping";
import type {
  ConstructionElement,
  JointConnection,
  JointType,
  MaterialProfile,
  Point3D,
} from "@/types";

export const JOINT_TYPE_LABELS: Record<JointType, string> = {
  miter_90: "Под углом 90°",
  miter_45: "Под углом 45°",
  t_joint: "Т-образное",
  lap: "Внахлёст",
  butt: "Простое примыкание",
};

function pointsClose3D(a: Point3D, b: Point3D, toleranceMm = 2): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= toleranceMm;
}

function pointOnSegmentInterior2D(
  p: Point3D,
  a: Point3D,
  b: Point3D,
  toleranceMm = 2
): boolean {
  if (Math.abs(p.z - a.z) > toleranceMm || Math.abs(p.z - b.z) > toleranceMm) {
    return false;
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1) return false;

  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  if (t <= 0.02 || t >= 0.98) return false;

  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY) <= toleranceMm;
}

function angleBetweenElementsDeg(a: ConstructionElement, b: ConstructionElement, shared: Point3D): number {
  const va = pointsClose3D(a.start, shared)
    ? { x: a.end.x - a.start.x, y: a.end.y - a.start.y }
    : { x: a.start.x - a.end.x, y: a.start.y - a.end.y };
  const vb = pointsClose3D(b.start, shared)
    ? { x: b.end.x - b.start.x, y: b.end.y - b.start.y }
    : { x: b.start.x - b.end.x, y: b.start.y - b.end.y };

  const magA = Math.hypot(va.x, va.y);
  const magB = Math.hypot(vb.x, vb.y);
  if (magA < 1e-3 || magB < 1e-3) return 0;

  const cos = Math.max(-1, Math.min(1, (va.x * vb.x + va.y * vb.y) / (magA * magB)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function classifyEndpointJoint(angleDeg: number): { type: JointType; cutAngleDeg?: number } {
  if (Math.abs(angleDeg - 90) <= 6) {
    return { type: "miter_90", cutAngleDeg: 45 };
  }
  if (Math.abs(angleDeg - 45) <= 6 || Math.abs(angleDeg - 135) <= 6) {
    return { type: "miter_45", cutAngleDeg: 22.5 };
  }
  return { type: "butt" };
}

/**
 * Оценочная длина сварного шва по периметру сечения меньшего (или примыкающего) профиля, мм.
 * Используется только по явному действию пользователя, не подставляется автоматически.
 */
export function estimateJointPerimeterWeldMm(
  joint: JointConnection,
  elements: ConstructionElement[],
  profiles: MaterialProfile[]
): number | null {
  const related = elements.filter((el) => joint.elementIds.includes(el.id));
  if (related.length === 0) return null;

  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  let minPerimeter = Infinity;

  for (const el of related) {
    const profile = profileMap.get(el.profileId);
    if (!profile) continue;
    const perimeter = 2 * (profile.widthMm + profile.heightMm);
    if (perimeter < minPerimeter) {
      minPerimeter = perimeter;
    }
  }

  return Number.isFinite(minPerimeter) ? Math.round(minPerimeter) : null;
}

/**
 * Анализирует геометрию элементов конструкции и определяет узлы соединений
 * (стыки концов под 90°/45°/примыкание, Т-образные и внахлёст).
 * Существующие ручные настройки (тип, длина шва, примечание) сохраняются для совпавших узлов.
 */
export function detectProjectJoints(
  elements: ConstructionElement[],
  existingJoints: JointConnection[] = []
): JointConnection[] {
  const detected: JointConnection[] = [];
  const usedPairs = new Set<string>();

  const makePairKey = (id1: string, id2: string, pos: Point3D) => {
    const sorted = [id1, id2].sort().join("|");
    return `${sorted}@${Math.round(pos.x)}:${Math.round(pos.y)}:${Math.round(pos.z)}`;
  };

  for (let i = 0; i < elements.length; i += 1) {
    for (let j = i + 1; j < elements.length; j += 1) {
      const a = elements[i];
      const b = elements[j];

      // 1. Проверка совпадения концов (угловые и стыковые соединения)
      const endpointPairs: [Point3D, Point3D][] = [
        [a.start, b.start],
        [a.start, b.end],
        [a.end, b.start],
        [a.end, b.end],
      ];

      let matchedEndpoint = false;
      for (const [pa, pb] of endpointPairs) {
        if (pointsClose3D(pa, pb)) {
          const pos = {
            x: Math.round((pa.x + pb.x) / 2),
            y: Math.round((pa.y + pb.y) / 2),
            z: Math.round((pa.z + pb.z) / 2),
          };
          const key = makePairKey(a.id, b.id, pos);
          if (!usedPairs.has(key)) {
            usedPairs.add(key);
            const angleDeg = angleBetweenElementsDeg(a, b, pos);
            const classified = classifyEndpointJoint(angleDeg);
            detected.push({
              id: `j-${detected.length + 1}-${Date.now().toString(36).slice(-4)}`,
              type: classified.type,
              elementIds: [a.id, b.id],
              position: pos,
              weldLengthMm: null,
              cutAngleDeg: classified.cutAngleDeg,
            });
          }
          matchedEndpoint = true;
          break;
        }
      }
      if (matchedEndpoint) continue;

      // 2. Т-образное примыкание (конец одного элемента упирается в середину другого)
      const tCandidates: { pt: Point3D; host: ConstructionElement }[] = [
        { pt: a.start, host: b },
        { pt: a.end, host: b },
        { pt: b.start, host: a },
        { pt: b.end, host: a },
      ];

      let matchedT = false;
      for (const cand of tCandidates) {
        const otherEnd = cand.host === b ? b : a;
        if (pointOnSegmentInterior2D(cand.pt, otherEnd.start, otherEnd.end)) {
          const pos = { x: Math.round(cand.pt.x), y: Math.round(cand.pt.y), z: Math.round(cand.pt.z) };
          const key = makePairKey(a.id, b.id, pos);
          if (!usedPairs.has(key)) {
            usedPairs.add(key);
            detected.push({
              id: `j-${detected.length + 1}-${Date.now().toString(36).slice(-4)}`,
              type: "t_joint",
              elementIds: [a.id, b.id],
              position: pos,
              weldLengthMm: null,
            });
          }
          matchedT = true;
          break;
        }
      }
      if (matchedT) continue;

      // 3. Внутреннее пересечение (внахлёст)
      if (Math.abs(a.start.z - b.start.z) <= 2) {
        const hit = findSegmentIntersection2D(a.start, a.end, b.start, b.end);
        if (hit) {
          const pos = { x: Math.round(hit.x), y: Math.round(hit.y), z: Math.round(a.start.z) };
          const key = makePairKey(a.id, b.id, pos);
          if (!usedPairs.has(key)) {
            usedPairs.add(key);
            detected.push({
              id: `j-${detected.length + 1}-${Date.now().toString(36).slice(-4)}`,
              type: "lap",
              elementIds: [a.id, b.id],
              position: pos,
              weldLengthMm: null,
            });
          }
        }
      }
    }
  }

  // Переносим сохранённые вручную параметры из existingJoints, если узел совпал
  return detected.map((item) => {
    const match = existingJoints.find(
      (ex) =>
        pointsClose3D(ex.position, item.position, 4) &&
        item.elementIds.every((id) => ex.elementIds.includes(id))
    );
    if (!match) return item;
    return {
      ...item,
      id: match.id,
      type: match.type,
      weldLengthMm: match.weldLengthMm,
      cutAngleDeg: match.cutAngleDeg ?? item.cutAngleDeg,
      processingNotes: match.processingNotes,
    };
  });
}
