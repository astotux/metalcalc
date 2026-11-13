/**
 * Типы сечений металлопроката.
 * В первой версии реализованы прямоугольные и квадратные трубы,
 * архитектура предусматривает дальнейшее расширение без изменения базовой модели.
 */
export type ProfileShapeType =
  | "rectangular_tube"
  | "square_tube"
  | "round_tube"
  | "angle"
  | "channel"
  | "i_beam"
  | "strip"
  | "sheet";

/** Профильная труба / материал из каталога. */
export interface MaterialProfile {
  id: string;
  name: string;
  shapeType: ProfileShapeType;
  /** Ширина сечения, мм. */
  widthMm: number;
  /** Высота сечения, мм. */
  heightMm: number;
  /** Толщина стенки, мм. */
  wallThicknessMm: number;
  /** Внешний диаметр, мм (для круглых труб в будущих версиях). */
  diameterMm?: number;
  /** Стоимость за 1 погонный метр. */
  pricePerMeter: number;
  /** Цвет отображения профиля в 2D/3D-редакторе. */
  color: string;
  /** Дополнительное описание материала. */
  description?: string;
  /** Признак демонстрационного профиля-примера. */
  isExample?: boolean;
}

/** Метаданные для отображения доступных типов сечений в интерфейсе. */
export interface ProfileShapeMeta {
  type: ProfileShapeType;
  label: string;
  implementedInMvp: boolean;
}
