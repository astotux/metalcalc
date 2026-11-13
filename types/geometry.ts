/** Точка в 3D-пространстве (все координаты в миллиметрах). */
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/** Точка на 2D-плоскости (все координаты в миллиметрах). */
export interface Point2D {
  x: number;
  y: number;
}

/** Тип конструктивного элемента (расширяемый для будущих версий). */
export type ElementType = "beam";

/**
 * Единый элемент конструкции в центральной модели данных.
 * 2D-черчение и 3D-визуализация работают с этим объектом напрямую.
 * Вычисляемые значения (длина, угол) не хранятся как источник истины,
 * а вычисляются из координат start и end.
 */
export interface ConstructionElement {
  id: string;
  type: ElementType;
  start: Point3D;
  end: Point3D;
  profileId: string;
  /** Переопределение цвета отображения (если не задано — берётся цвет профиля). */
  color?: string;
  /** Исключить элемент из расчёта покраски. */
  excludeFromPainting?: boolean;
  /** Необязательная пользовательская метка элемента. */
  label?: string;
  /** Идентификатор группы при группировке элементов. */
  groupId?: string;
  /** Ссылка на соединение в начальной точке. */
  jointStartId?: string;
  /** Ссылка на соединение в конечной точке. */
  jointEndId?: string;
}

/** Группа объединённых конструктивных элементов. */
export interface ElementGroup {
  id: string;
  name: string;
  elementIds: string[];
}
