import type { ConstructionElement, Point3D } from "@/types";

/** Вычисляет точную длину элемента конструкции в миллиметрах по координатам start и end. */
export function getElementLengthMm(element: Pick<ConstructionElement, "start" | "end">): number {
  const dx = element.end.x - element.start.x;
  const dy = element.end.y - element.start.y;
  const dz = element.end.z - element.start.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Переводит миллиметры в метры с сохранением полной точности. */
export function mmToMeters(mm: number): number {
  return mm / 1000;
}

/** Округляет длину в миллиметрах до 2 знаков после запятой для отображения. */
export function roundMm(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Вычисляет угол элемента в 2D-плоскости XY в градусах (-180..180]. */
export function getElementAngleDeg2D(element: Pick<ConstructionElement, "start" | "end">): number {
  const dx = element.end.x - element.start.x;
  const dy = element.end.y - element.start.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/** Возвращает геометрический центр элемента в 3D-пространстве. */
export function getElementMidpoint(element: Pick<ConstructionElement, "start" | "end">): Point3D {
  return {
    x: (element.start.x + element.end.x) / 2,
    y: (element.start.y + element.end.y) / 2,
    z: (element.start.z + element.end.z) / 2,
  };
}

/**
 * Возвращает новую конечную точку элемента при изменении его длины,
 * сохраняя текущее направление от точки start.
 */
export function resizeElementEndByLength(
  element: Pick<ConstructionElement, "start" | "end">,
  targetLengthMm: number
): Point3D {
  const safeLength = Math.max(1, targetLengthMm);
  const currentLength = getElementLengthMm(element);

  if (currentLength < 1e-6) {
    return {
      x: roundMm(element.start.x + safeLength),
      y: element.start.y,
      z: element.start.z,
    };
  }

  const ratio = safeLength / currentLength;
  return {
    x: roundMm(element.start.x + (element.end.x - element.start.x) * ratio),
    y: roundMm(element.start.y + (element.end.y - element.start.y) * ratio),
    z: roundMm(element.start.z + (element.end.z - element.start.z) * ratio),
  };
}
