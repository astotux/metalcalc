import type { CalculationSettings } from "./calculation";
import type { ConstructionElement, ElementGroup, Point2D } from "./geometry";
import type { JointConnection } from "./joints";
import type { MaterialProfile } from "./profile";

/** Режим отображения рабочей области. */
export type ViewMode = "2d" | "3d";

/** Доступные инструменты черчения в 2D-редакторе. */
export type DrawingTool =
  | "select"
  | "line"
  | "rectangle"
  | "polyline"
  | "delete"
  | "move"
  | "copy"
  | "resize";

/** Предустановки камеры для 3D-просмотра. */
export type CameraPreset = "isometric" | "top" | "front" | "side";

/** Статус сохранения проекта. */
export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

/** Настройки координатной сетки и привязок в миллиметрах. */
export interface GridSettings {
  /** Шаг основной (крупной) сетки, мм. */
  majorStepMm: number;
  /** Шаг дополнительной (мелкой) сетки, мм. */
  minorStepMm: number;
  /** Включена ли привязка в целом. */
  snapEnabled: boolean;
  snapToGrid: boolean;
  snapToEndpoints: boolean;
  snapToIntersections: boolean;
  snapToAngles: boolean;
  showGrid: boolean;
  showAxes: boolean;
  showDimensions: boolean;
}

/** Настройки отображения рабочей области. */
export interface DisplaySettings {
  viewMode: ViewMode;
  cameraPreset: CameraPreset;
  /** Масштаб 2D-вида (1 = 100%, px per mm масштабируется относительно базового коэффициента). */
  zoomPercent: number;
  panOffsetMm: Point2D;
  showJoints: boolean;
  showProfileColors: boolean;
}

/** Полная модель сохраняемого проекта MetalCalc. */
export interface MetalCalcProject {
  id: string;
  name: string;
  description?: string;
  isExample: boolean;
  elements: ConstructionElement[];
  groups: ElementGroup[];
  profiles: MaterialProfile[];
  joints: JointConnection[];
  calculationSettings: CalculationSettings;
  gridSettings: GridSettings;
  displaySettings: DisplaySettings;
  createdAt: string;
  updatedAt: string;
}
