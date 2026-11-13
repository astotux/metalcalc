import * as THREE from "three";
import type { BeamTrimData } from "@/lib/geometry/jointTrimming";
import type { CameraPreset, ConstructionElement, MaterialProfile, Point3D } from "@/types";

/** Перевод миллиметров модели в метры 3D-сцены (1000 мм = 1 единица сцены). */
export const MM_TO_SCENE = 0.001;

/**
 * Конвертирует точку модели (XY — плоскость чертежа, Z — высота)
 * в координаты Three.js (X — вправо, Y — вверх, Z — вглубь).
 */
export function modelPointToScene(point: Point3D): THREE.Vector3 {
  return new THREE.Vector3(
    point.x * MM_TO_SCENE,
    point.z * MM_TO_SCENE,
    point.y * MM_TO_SCENE
  );
}

export interface BeamTransform3D {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  lengthMeters: number;
}

/**
 * Вычисляет 3D-позицию центра балки, её длину в метрах и устойчивый кватернион поворота,
 * при котором локальная ось Z направлена вдоль балки, а локальная Y стремится вверх.
 */
export function computeBeamTransform3D(
  startMm: Point3D,
  endMm: Point3D
): BeamTransform3D {
  const start = modelPointToScene(startMm);
  const end = modelPointToScene(endMm);
  const delta = new THREE.Vector3().subVectors(end, start);
  const lengthMeters = delta.length();

  const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

  if (lengthMeters < 1e-6) {
    return {
      position: [center.x, center.y, center.z],
      quaternion: [0, 0, 0, 1],
      lengthMeters: 0.001,
    };
  }

  const zAxis = delta.clone().normalize();
  const worldUp = new THREE.Vector3(0, 1, 0);

  // Для вертикальных балок используем +X как опорный вектор, чтобы избежать вырождения cross-product
  const xAxis =
    Math.abs(zAxis.dot(worldUp)) > 0.999
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3().crossVectors(worldUp, zAxis).normalize();

  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();

  const rotMatrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  const quat = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);

  return {
    position: [center.x, center.y, center.z],
    quaternion: [quat.x, quat.y, quat.z, quat.w],
    lengthMeters,
  };
}

/**
 * Создаёт полую 3D-геометрию прямоугольной или квадратной профильной трубы,
 * центрированную в (0, 0, 0) и вытянутую вдоль локальной оси Z на lengthMeters.
 * При передаче `trim` подрезает/сращивает торцы по плоскостям стыков.
 */
export function createHollowTubeGeometry(
  profile: Pick<MaterialProfile, "widthMm" | "heightMm" | "wallThicknessMm">,
  lengthMeters: number,
  trim?: BeamTrimData
): THREE.BufferGeometry {
  const w = Math.max(0.004, profile.widthMm * MM_TO_SCENE);
  const h = Math.max(0.004, profile.heightMm * MM_TO_SCENE);
  const safeLength = Math.max(0.002, lengthMeters);

  // Ограничиваем толщину стенки, чтобы внутренний вырез оставался корректным
  const maxWall = Math.min(w, h) * 0.45;
  const wall = Math.max(0.0005, Math.min(maxWall, profile.wallThicknessMm * MM_TO_SCENE));

  const hw = w / 2;
  const hh = h / 2;

  const outerShape = new THREE.Shape();
  outerShape.moveTo(-hw, -hh);
  outerShape.lineTo(hw, -hh);
  outerShape.lineTo(hw, hh);
  outerShape.lineTo(-hw, hh);
  outerShape.closePath();

  const ihw = hw - wall;
  const ihh = hh - wall;
  if (ihw > 0.0003 && ihh > 0.0003) {
    const innerHole = new THREE.Path();
    innerHole.moveTo(-ihw, -ihh);
    innerHole.lineTo(-ihw, ihh);
    innerHole.lineTo(ihw, ihh);
    innerHole.lineTo(ihw, -ihh);
    innerHole.closePath();
    outerShape.holes.push(innerHole);
  }

  const geometry = new THREE.ExtrudeGeometry(outerShape, {
    depth: safeLength,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1,
  });

  // Центрируем экструзию по локальной оси Z вокруг середины балки
  geometry.translate(0, 0, -safeLength / 2);

  if (
    trim &&
    (trim.start.d0Mm !== 0 ||
      trim.start.slopeX !== 0 ||
      trim.start.slopeY !== 0 ||
      trim.end.d0Mm !== 0 ||
      trim.end.slopeX !== 0 ||
      trim.end.slopeY !== 0)
  ) {
    const posAttr = geometry.getAttribute("position");
    for (let i = 0; i < posAttr.count; i += 1) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      const cut = z < 0 ? trim.start : trim.end;
      const dz = cut.d0Mm * MM_TO_SCENE + cut.slopeX * x + cut.slopeY * y;
      posAttr.setZ(i, z + dz);
    }
    posAttr.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  geometry.computeVertexNormals();
  return geometry;
}

/** Вычисляет ограничивающий центр и радиус всей конструкции для наведения 3D-камеры. */
export function computeConstructionBounds3D(elements: ConstructionElement[]): {
  center: [number, number, number];
  radiusMeters: number;
} {
  if (elements.length === 0) {
    return { center: [0.6, 0, 0.3], radiusMeters: 1.5 };
  }

  const box = new THREE.Box3();
  for (const el of elements) {
    box.expandByPoint(modelPointToScene(el.start));
    box.expandByPoint(modelPointToScene(el.end));
  }

  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  const radiusMeters = Math.max(0.8, size.length() * 0.65);
  return {
    center: [center.x, center.y, center.z],
    radiusMeters,
  };
}

/** Возвращает позицию камеры (в метрах) для выбранного пресета вида. */
export function getCameraPoseForPreset(
  preset: CameraPreset,
  center: [number, number, number],
  radiusMeters: number
): { position: [number, number, number]; target: [number, number, number] } {
  const d = Math.max(1.6, radiusMeters * 2.1);
  const [cx, cy, cz] = center;

  switch (preset) {
    case "top":
      return {
        position: [cx, cy + d, cz + 0.001],
        target: [cx, cy, cz],
      };
    case "front":
      return {
        position: [cx, cy + d * 0.05, cz + d],
        target: [cx, cy, cz],
      };
    case "side":
      return {
        position: [cx + d, cy + d * 0.05, cz],
        target: [cx, cy, cz],
      };
    case "isometric":
    default:
      return {
        position: [cx + d * 0.75, cy + d * 0.65, cz + d * 0.75],
        target: [cx, cy, cz],
      };
  }
}
