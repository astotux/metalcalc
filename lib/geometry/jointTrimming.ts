import type {
  ConstructionElement,
  JointConnection,
  MaterialProfile,
  Point2D,
  Point3D,
} from "@/types";

const JOINT_POS_TOLERANCE_MM = 2.5;
const MATCH_JOINT_TOLERANCE_MM = 5;

export interface EndCutSpec {
  /** Смещение центра торца вдоль +zAxis балки, мм (может быть < 0 или > 0). */
  d0Mm: number;
  /** Наклон плоскости реза по локальной оси X сечения (безразмерный tan). */
  slopeX: number;
  /** Наклон плоскости реза по локальной оси Y сечения (безразмерный tan). */
  slopeY: number;
}

export interface BeamTrimData {
  start: EndCutSpec;
  end: EndCutSpec;
}

export interface ElementBasis3D {
  xAxis: Point3D;
  yAxis: Point3D;
  zAxis: Point3D;
  lengthMm: number;
}

const ZERO_CUT: EndCutSpec = { d0Mm: 0, slopeX: 0, slopeY: 0 };

function dot(a: Point3D, b: Point3D): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function sub(a: Point3D, b: Point3D): Point3D {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function add(a: Point3D, b: Point3D): Point3D {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(v: Point3D, s: number): Point3D {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function cross(a: Point3D, b: Point3D): Point3D {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function len3(v: Point3D): number {
  return Math.hypot(v.x, v.y, v.z);
}

function normalize(v: Point3D): Point3D {
  const l = len3(v);
  if (l < 1e-9) return { x: 1, y: 0, z: 0 };
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

function dist3(a: Point3D, b: Point3D): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * Вычисляет локальный ортонормированный базис балки в модельных координатах (мм),
 * полностью согласованный с Three.js преобразованием в `computeBeamTransform3D`.
 */
export function getElementBasis3D(
  start: Point3D,
  end: Point3D
): ElementBasis3D {
  const deltaModel = sub(end, start);
  const lengthMm = len3(deltaModel);
  if (lengthMm < 1e-6) {
    return {
      xAxis: { x: 1, y: 0, z: 0 },
      yAxis: { x: 0, y: 0, z: 1 },
      zAxis: { x: 0, y: 1, z: 0 },
      lengthMm: 0,
    };
  }

  // Переводим в координаты сцены Three.js (Y <-> Z), чтобы совпасть с computeBeamTransform3D
  const zS = normalize({ x: deltaModel.x, y: deltaModel.z, z: deltaModel.y });
  const worldUpS: Point3D = { x: 0, y: 1, z: 0 };
  const xS =
    Math.abs(dot(zS, worldUpS)) > 0.999
      ? { x: 1, y: 0, z: 0 }
      : normalize(cross(worldUpS, zS));
  const yS = normalize(cross(zS, xS));

  // Обратно в модельные координаты (X, Y=Z_scene, Z=Y_scene)
  return {
    xAxis: { x: xS.x, y: xS.z, z: xS.y },
    yAxis: { x: yS.x, y: yS.z, z: yS.y },
    zAxis: { x: zS.x, y: zS.z, z: zS.y },
    lengthMm,
  };
}

function getProfileDims(profile: MaterialProfile | undefined): { hw: number; hh: number } {
  const widthMm = profile?.widthMm ?? 40;
  const heightMm = profile?.heightMm ?? 40;
  return { hw: Math.max(2, widthMm / 2), hh: Math.max(2, heightMm / 2) };
}

/** Полуразмер прямоугольного сечения балки вдоль произвольного единичного вектора `dir`. */
function halfExtentAlong(
  basis: ElementBasis3D,
  hw: number,
  hh: number,
  dir: Point3D
): number {
  return hw * Math.abs(dot(basis.xAxis, dir)) + hh * Math.abs(dot(basis.yAxis, dir));
}

/**
 * Вычисляет параметры подрезки торца балки плоскостью (planePoint, planeNormal).
 */
function cutByPlane(
  anchor: Point3D,
  basis: ElementBasis3D,
  hw: number,
  hh: number,
  planePoint: Point3D,
  planeNormal: Point3D
): EndCutSpec {
  const n = normalize(planeNormal);
  const denom = dot(basis.zAxis, n);
  if (Math.abs(denom) < 0.18) {
    return ZERO_CUT;
  }

  let d0Mm = dot(sub(planePoint, anchor), n) / denom;
  let slopeX = -dot(basis.xAxis, n) / denom;
  let slopeY = -dot(basis.yAxis, n) / denom;

  // Защита от экстремального вытягивания иглы при сверхмалых углах
  const maxSlope = 3.5;
  slopeX = Math.max(-maxSlope, Math.min(maxSlope, slopeX));
  slopeY = Math.max(-maxSlope, Math.min(maxSlope, slopeY));

  const maxOffset = Math.max(hw, hh) * 4;
  d0Mm = Math.max(-maxOffset, Math.min(maxOffset, d0Mm));

  return { d0Mm, slopeX, slopeY };
}

/** Ограничивает обрезку концов, чтобы стартовый и конечный торцы не пересеклись внутри короткой балки. */
function clampTrimToBeamLength(
  trim: BeamTrimData,
  lengthMm: number,
  hw: number,
  hh: number
): BeamTrimData {
  if (lengthMm < 4) return { start: ZERO_CUT, end: ZERO_CUT };

  const evalMaxStart = (c: EndCutSpec) =>
    c.d0Mm + Math.abs(c.slopeX) * hw + Math.abs(c.slopeY) * hh;
  const evalMinEnd = (c: EndCutSpec) =>
    lengthMm + c.d0Mm - (Math.abs(c.slopeX) * hw + Math.abs(c.slopeY) * hh);

  let start = trim.start;
  let end = trim.end;

  if (evalMaxStart(start) > lengthMm * 0.45) {
    start = ZERO_CUT;
  }
  if (evalMinEnd(end) < lengthMm * 0.55) {
    end = ZERO_CUT;
  }
  return { start, end };
}

/** Вычисляет ближайшую плоскую боковую грань опорной балки `host`, обращённую в сторону `towardDir`. */
function getHostBoxFacePlane(
  hostPos: Point3D,
  hostBasis: ElementBasis3D,
  hostHw: number,
  hostHh: number,
  towardDir: Point3D
): { point: Point3D; normal: Point3D } {
  const perp = sub(towardDir, scale(hostBasis.zAxis, dot(towardDir, hostBasis.zAxis)));
  const perpDir = len3(perp) > 1e-5 ? normalize(perp) : hostBasis.xAxis;

  const projX = dot(perpDir, hostBasis.xAxis);
  const projY = dot(perpDir, hostBasis.yAxis);

  if (Math.abs(projX) / hostHw >= Math.abs(projY) / hostHh) {
    const normal = projX >= 0 ? hostBasis.xAxis : scale(hostBasis.xAxis, -1);
    return { point: add(hostPos, scale(normal, hostHw)), normal };
  }
  const normal = projY >= 0 ? hostBasis.yAxis : scale(hostBasis.yAxis, -1);
  return { point: add(hostPos, scale(normal, hostHh)), normal };
}

interface EndpointRef {
  element: ConstructionElement;
  endpoint: "start" | "end";
  pos: Point3D;
  dirOut: Point3D;
  basis: ElementBasis3D;
  hw: number;
  hh: number;
}

function findMatchingJoint(
  joints: JointConnection[],
  pos: Point3D,
  elementIds: string[]
): JointConnection | undefined {
  return joints.find(
    (j) =>
      dist3(j.position, pos) <= MATCH_JOINT_TOLERANCE_MM &&
      j.elementIds.some((id) => elementIds.includes(id))
  );
}

/** Вычисляет плоскость косого реза ("на ус" / miter) для двух труб в одной точке. */
function computeMiterPlane(
  pos: Point3D,
  a: EndpointRef,
  b: EndpointRef
): { point: Point3D; normal: Point3D } | null {
  const cosTheta = dot(a.dirOut, b.dirOut);
  if (Math.abs(cosTheta) > 0.96) return null; // угол < ~16° или ~180° — прямая линия

  const planeNormal = normalize(cross(a.dirOut, b.dirOut));
  // Единичный вектор в плоскости угла, перпендикулярный A и смотрящий в сторону B
  let sA = normalize(cross(planeNormal, a.dirOut));
  if (dot(sA, b.dirOut) < 0) sA = scale(sA, -1);

  // Единичный вектор в плоскости угла, перпендикулярный B и смотрящий в сторону A
  let sB = normalize(cross(planeNormal, b.dirOut));
  if (dot(sB, a.dirOut) < 0) sB = scale(sB, -1);

  const halfA = halfExtentAlong(a.basis, a.hw, a.hh, sA);
  const halfB = halfExtentAlong(b.basis, b.hw, b.hh, sB);

  const sinTheta = dot(a.dirOut, sB);
  if (Math.abs(sinTheta) < 0.22) return null;

  // Пересечение внутренних кромок A (+halfA*sA) и B (+halfB*sB):
  // P_inner = P + tA_in * uA + halfA * sA
  const sAdotSB = dot(sA, sB);
  const tAIn = (halfB - halfA * sAdotSB) / sinTheta;
  const pInner = add(pos, add(scale(a.dirOut, tAIn), scale(sA, halfA)));

  // Пересечение внешних кромок A (-halfA*sA) и B (-halfB*sB):
  const pOuter = add(pos, add(scale(a.dirOut, -tAIn), scale(sA, -halfA)));

  const cutDir = sub(pInner, pOuter);
  const miterNormal = normalize(cross(cutDir, planeNormal));
  return { point: pos, normal: miterNormal };
}

/**
 * Рассчитывает автоматическую (и переопределяемую через `joints`) геометрию сращивания
 * торцов для всех элементов конструкции.
 */
export function computeElementTrims(
  elements: ConstructionElement[],
  profiles: MaterialProfile[],
  joints: JointConnection[] = []
): Map<string, BeamTrimData> {
  const result = new Map<string, BeamTrimData>();
  if (elements.length === 0) return result;

  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const basisMap = new Map<string, ElementBasis3D>();

  const refs: EndpointRef[] = [];
  for (const el of elements) {
    result.set(el.id, { start: ZERO_CUT, end: ZERO_CUT });
    const basis = getElementBasis3D(el.start, el.end);
    basisMap.set(el.id, basis);
    if (basis.lengthMm < 1) continue;

    const { hw, hh } = getProfileDims(profileMap.get(el.profileId));
    refs.push({
      element: el,
      endpoint: "start",
      pos: el.start,
      dirOut: basis.zAxis,
      basis,
      hw,
      hh,
    });
    refs.push({
      element: el,
      endpoint: "end",
      pos: el.end,
      dirOut: scale(basis.zAxis, -1),
      basis,
      hw,
      hh,
    });
  }

  const setEndCut = (ref: EndpointRef, cut: EndCutSpec) => {
    const existing = result.get(ref.element.id);
    if (!existing) return;
    if (ref.endpoint === "start") existing.start = cut;
    else existing.end = cut;
  };

  // 1. Кластеризация концов по 3D-позициям
  const visited = new Set<number>();
  const singleRefs: EndpointRef[] = [];

  for (let i = 0; i < refs.length; i += 1) {
    if (visited.has(i)) continue;
    visited.add(i);

    const cluster: EndpointRef[] = [refs[i]];
    for (let j = i + 1; j < refs.length; j += 1) {
      if (visited.has(j)) continue;
      if (refs[j].element.id === refs[i].element.id) continue;
      if (dist3(refs[i].pos, refs[j].pos) <= JOINT_POS_TOLERANCE_MM) {
        visited.add(j);
        cluster.push(refs[j]);
      }
    }

    if (cluster.length === 1) {
      singleRefs.push(cluster[0]);
      continue;
    }

    const pos = {
      x: cluster.reduce((s, r) => s + r.pos.x, 0) / cluster.length,
      y: cluster.reduce((s, r) => s + r.pos.y, 0) / cluster.length,
      z: cluster.reduce((s, r) => s + r.pos.z, 0) / cluster.length,
    };

    const matchedJoint = findMatchingJoint(
      joints,
      pos,
      cluster.map((c) => c.element.id)
    );

    if (matchedJoint?.trimMode === "none" || matchedJoint?.type === "lap") {
      continue;
    }

    const mode =
      matchedJoint?.trimMode && matchedJoint.trimMode !== "auto"
        ? matchedJoint.trimMode
        : matchedJoint?.type === "butt"
          ? "butt"
          : "miter";

    if (cluster.length === 2) {
      const [a, b] = cluster;
      if (mode === "miter") {
        const plane = computeMiterPlane(pos, a, b);
        if (plane) {
          setEndCut(a, cutByPlane(a.pos, a.basis, a.hw, a.hh, plane.point, plane.normal));
          setEndCut(b, cutByPlane(b.pos, b.basis, b.hw, b.hh, plane.point, plane.normal));
        }
      } else {
        // Встык (butt): одна сквозная (primary), вторая упирается в её боковую стенку
        const primary =
          matchedJoint?.primaryElementId === b.element.id
            ? b
            : matchedJoint?.primaryElementId === a.element.id
              ? a
              : a.hw * a.hh >= b.hw * b.hh
                ? a
                : b;
        const secondary = primary === a ? b : a;

        const extMm = halfExtentAlong(secondary.basis, secondary.hw, secondary.hh, primary.dirOut);
        const primaryPlanePoint = sub(pos, scale(primary.dirOut, extMm));
        setEndCut(
          primary,
          cutByPlane(
            primary.pos,
            primary.basis,
            primary.hw,
            primary.hh,
            primaryPlanePoint,
            primary.dirOut
          )
        );

        const wallPlane = getHostBoxFacePlane(
          pos,
          primary.basis,
          primary.hw,
          primary.hh,
          secondary.dirOut
        );
        setEndCut(
          secondary,
          cutByPlane(
            secondary.pos,
            secondary.basis,
            secondary.hw,
            secondary.hh,
            wallPlane.point,
            wallPlane.normal
          )
        );
      }
      continue;
    }

    // 3D-узел (3 и более труб): выбираем главную рамную пару (горизонтальную или с наибольшим углом),
    // сращиваем её "на ус", а остальные подрезаем до грани рамки встык.
    let pairA = cluster[0];
    let pairB = cluster[1];
    let bestScore = -1;

    for (let p = 0; p < cluster.length; p += 1) {
      for (let q = p + 1; q < cluster.length; q += 1) {
        const u = cluster[p].dirOut;
        const v = cluster[q].dirOut;
        const crossMag = len3(cross(u, v));
        if (crossMag < 0.25) continue;
        // Небольшое предпочтение горизонтальным (Z ≈ 0) рамным парам
        const horizBonus = 1 - (Math.abs(u.z) + Math.abs(v.z)) * 0.25;
        const score = crossMag * horizBonus;
        if (score > bestScore) {
          bestScore = score;
          pairA = cluster[p];
          pairB = cluster[q];
        }
      }
    }

    if (mode === "miter" && bestScore > 0) {
      const plane = computeMiterPlane(pos, pairA, pairB);
      if (plane) {
        setEndCut(
          pairA,
          cutByPlane(pairA.pos, pairA.basis, pairA.hw, pairA.hh, plane.point, plane.normal)
        );
        setEndCut(
          pairB,
          cutByPlane(pairB.pos, pairB.basis, pairB.hw, pairB.hh, plane.point, plane.normal)
        );
      }

      for (const other of cluster) {
        if (other === pairA || other === pairB) continue;
        const wallA = getHostBoxFacePlane(
          pos,
          pairA.basis,
          pairA.hw,
          pairA.hh,
          other.dirOut
        );
        const wallB = getHostBoxFacePlane(
          pos,
          pairB.basis,
          pairB.hw,
          pairB.hh,
          other.dirOut
        );
        // Выбираем грань, которая подрезает дальше вдоль other.dirOut
        const cutA = cutByPlane(
          other.pos,
          other.basis,
          other.hw,
          other.hh,
          wallA.point,
          wallA.normal
        );
        const cutB = cutByPlane(
          other.pos,
          other.basis,
          other.hw,
          other.hh,
          wallB.point,
          wallB.normal
        );
        const absCut =
          Math.abs(cutA.d0Mm) >= Math.abs(cutB.d0Mm) ? cutA : cutB;
        setEndCut(other, absCut);
      }
    } else {
      const primary =
        cluster.find((c) => c.element.id === matchedJoint?.primaryElementId) ?? cluster[0];
      for (const other of cluster) {
        if (other === primary) continue;
        const wall = getHostBoxFacePlane(
          pos,
          primary.basis,
          primary.hw,
          primary.hh,
          other.dirOut
        );
        setEndCut(
          other,
          cutByPlane(other.pos, other.basis, other.hw, other.hh, wall.point, wall.normal)
        );
      }
    }
  }

  // 2. Т-образные примыкания для одиночных концов, упирающихся в тело другой балки
  for (const ref of singleRefs) {
    let bestHost: ConstructionElement | null = null;
    let bestDist = JOINT_POS_TOLERANCE_MM;
    let bestHit: Point3D | null = null;

    for (const host of elements) {
      if (host.id === ref.element.id) continue;
      const hostBasis = basisMap.get(host.id);
      if (!hostBasis || hostBasis.lengthMm < 2) continue;

      const delta = sub(host.end, host.start);
      const lenSq = dot(delta, delta);
      const t = dot(sub(ref.pos, host.start), delta) / lenSq;
      if (t <= 0.02 || t >= 0.98) continue;

      const proj = add(host.start, scale(delta, t));
      const d = dist3(ref.pos, proj);
      if (d <= bestDist) {
        bestDist = d;
        bestHost = host;
        bestHit = proj;
      }
    }

    if (!bestHost || !bestHit) continue;

    const matchedJoint = findMatchingJoint(joints, bestHit, [ref.element.id, bestHost.id]);
    if (matchedJoint?.trimMode === "none") continue;

    const hostBasis = basisMap.get(bestHost.id)!;
    const { hw: hostHw, hh: hostHh } = getProfileDims(profileMap.get(bestHost.profileId));
    const wall = getHostBoxFacePlane(bestHit, hostBasis, hostHw, hostHh, ref.dirOut);
    setEndCut(
      ref,
      cutByPlane(ref.pos, ref.basis, ref.hw, ref.hh, wall.point, wall.normal)
    );
  }

  // 3. Ограничение длины подрезки для каждой балки
  for (const el of elements) {
    const trim = result.get(el.id);
    const basis = basisMap.get(el.id);
    if (!trim || !basis) continue;
    const { hw, hh } = getProfileDims(profileMap.get(el.profileId));
    result.set(el.id, clampTrimToBeamLength(trim, basis.lengthMm, hw, hh));
  }

  return result;
}

/**
 * Возвращает 8 внешних углов 3D-призмы трубы в модельных миллиметрах с учётом подрезки торцов.
 */
export function getBeamOuterCorners3D(
  element: Pick<ConstructionElement, "start" | "end">,
  profile: MaterialProfile | undefined,
  trim?: BeamTrimData
): Point3D[] {
  const basis = getElementBasis3D(element.start, element.end);
  const { hw, hh } = getProfileDims(profile);
  const sCut = trim?.start ?? ZERO_CUT;
  const eCut = trim?.end ?? ZERO_CUT;

  const corners2D: Array<[number, number]> = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ];

  const points: Point3D[] = [];
  for (const [lx, ly] of corners2D) {
    const radial = add(scale(basis.xAxis, lx), scale(basis.yAxis, ly));
    const ds = sCut.d0Mm + sCut.slopeX * lx + sCut.slopeY * ly;
    const de = eCut.d0Mm + eCut.slopeX * lx + eCut.slopeY * ly;
    points.push(add(add(element.start, radial), scale(basis.zAxis, ds)));
    points.push(add(add(element.end, radial), scale(basis.zAxis, de)));
  }
  return points;
}

/** Строит выпуклую оболочку набора 2D-точек (алгоритм Эндрю). */
function convexHull2D(pts: Point2D[]): Point2D[] {
  if (pts.length <= 2) return pts;
  const sorted = [...pts].sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));
  const cross2 = (o: Point2D, a: Point2D, b: Point2D) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Point2D[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross2(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-6) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point2D[] = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const p = sorted[i];
    while (upper.length >= 2 && cross2(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-6) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Проецирует внешнюю форму балки (с учётом срезов углов/стыков) в замкнутый 2D-полигон
 * на ортогональную плоскость `xy`, `xz` или `yz` (в мировых координатах плоскости, мм).
 */
export function projectBeamPolygon2D(
  element: Pick<ConstructionElement, "start" | "end">,
  profile: MaterialProfile | undefined,
  trim: BeamTrimData | undefined,
  plane: "xy" | "xz" | "yz"
): Point2D[] {
  const corners3D = getBeamOuterCorners3D(element, profile, trim);
  const projected = corners3D.map((p) => {
    if (plane === "xz") return { x: p.x, y: p.z };
    if (plane === "yz") return { x: p.y, y: p.z };
    return { x: p.x, y: p.y };
  });
  return convexHull2D(projected);
}

/**
 * Сортирует элементы в порядке художника (от дальних к ближним относительно камеры
 * выбранной ортогональной проекции), чтобы ближние балки перекрывали дальние,
 * а не просвечивали насквозь.
 */
export function sortElementsByPlaneDepth<T extends Pick<ConstructionElement, "id" | "start" | "end" | "profileId">>(
  elements: T[],
  profileMap: Map<string, MaterialProfile>,
  trims: Map<string, BeamTrimData>,
  plane: "xy" | "xz" | "yz"
): T[] {
  const getDepth = (p: Point3D) => (plane === "xy" ? p.z : plane === "xz" ? p.y : p.x);

  return elements
    .map((el, index) => {
      const corners = getBeamOuterCorners3D(el, profileMap.get(el.profileId), trims.get(el.id));
      let sum = 0;
      let maxD = -Infinity;
      for (const c of corners) {
        const d = getDepth(c);
        sum += d;
        if (d > maxD) maxD = d;
      }
      return {
        el,
        index,
        avgDepth: sum / corners.length,
        maxDepth: maxD,
      };
    })
    .sort((a, b) => {
      if (Math.abs(a.avgDepth - b.avgDepth) > 1) {
        return a.avgDepth - b.avgDepth;
      }
      if (Math.abs(a.maxDepth - b.maxDepth) > 0.5) {
        return a.maxDepth - b.maxDepth;
      }
      return a.index - b.index;
    })
    .map((item) => item.el);
}
