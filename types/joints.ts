import type { Point3D } from "./geometry";

/** Режим геометрической подрезки/сращивания торцов в узле стыка. */
export type JointTrimMode = "auto" | "miter" | "butt" | "none";

/** Поддерживаемые типы соединений металлических элементов. */
export type JointType =
  | "miter_90"
  | "miter_45"
  | "t_joint"
  | "lap"
  | "butt";

/** Соединение между двумя или более элементами конструкции. */
export interface JointConnection {
  id: string;
  type: JointType;
  /** Идентификаторы связанных элементов. */
  elementIds: string[];
  /** Координаты узла соединения, мм. */
  position: Point3D;
  /**
   * Длина сварного шва в мм, заданная вручную или достоверно вычисленная.
   * null означает, что длина шва неизвестна и не должна автоматически приравниваться к длине трубы.
   */
  weldLengthMm: number | null;
  /** Угол реза, градусы. */
  cutAngleDeg?: number;
  /** Способ геометрической подрезки (по умолчанию выбирается автоматически по типу). */
  trimMode?: JointTrimMode;
  /** Для стыков встык / Т-стыков — идентификатор сквозного (проходного) элемента. */
  primaryElementId?: string;
  /** Параметры или примечания по обработке узла. */
  processingNotes?: string;
}
