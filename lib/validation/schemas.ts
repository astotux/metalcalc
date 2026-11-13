import { z } from "zod";

export const point3DSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
});

export const materialProfileSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1, "Укажите название профиля").max(80),
    shapeType: z.enum([
      "rectangular_tube",
      "square_tube",
      "round_tube",
      "angle",
      "channel",
      "i_beam",
      "strip",
      "sheet",
    ]),
    widthMm: z.number().positive("Ширина должна быть больше 0").max(2000),
    heightMm: z.number().positive("Высота должна быть больше 0").max(2000),
    wallThicknessMm: z.number().positive("Толщина стенки должна быть больше 0").max(100),
    pricePerMeter: z.number().min(0, "Цена не может быть отрицательной").max(1_000_000),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Некорректный HEX-цвет"),
    description: z.string().max(300).optional(),
    isExample: z.boolean().optional(),
  })
  .refine((data) => data.wallThicknessMm * 2 < Math.min(data.widthMm, data.heightMm), {
    message: "Удвоенная толщина стенки должна быть меньше ширины и высоты сечения",
    path: ["wallThicknessMm"],
  });

export const profileFormSchema = z
  .object({
    name: z.string().trim().min(1, "Укажите название профиля").max(80, "Максимум 80 символов"),
    shapeType: z.enum(["rectangular_tube", "square_tube"]),
    widthMm: z.number().min(5, "Минимум 5 мм").max(2000, "Максимум 2000 мм"),
    heightMm: z.number().min(5, "Минимум 5 мм").max(2000, "Максимум 2000 мм"),
    wallThicknessMm: z.number().min(0.5, "Минимум 0.5 мм").max(100, "Максимум 100 мм"),
    pricePerMeter: z.number().min(0, "Цена не может быть отрицательной").max(1_000_000),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Выберите корректный цвет"),
    description: z.string().max(300, "Максимум 300 символов").optional(),
  })
  .refine((data) => data.wallThicknessMm * 2 < Math.min(data.widthMm, data.heightMm), {
    message: "Толщина стенки не может превышать или равняться половине стороны сечения",
    path: ["wallThicknessMm"],
  });

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const calculationSettingsSchema = z.object({
  currency: z.enum(["RUB", "USD", "EUR", "KZT", "BYN"]),
  paintingPricePerMeter: z.number().min(0, "Цена покраски не может быть отрицательной"),
  weldPricingMode: z.enum(["per_meter", "per_joint"]),
  weldPricePerMeter: z.number().min(0, "Цена сварки не может быть отрицательной"),
  weldPricePerJoint: z.number().min(0, "Цена за соединение не может быть отрицательной"),
});

export const elementUpdateSchema = z.object({
  start: point3DSchema,
  end: point3DSchema,
  profileId: z.string().min(1),
  excludeFromPainting: z.boolean().optional(),
  label: z.string().max(80).optional(),
});

export const constructionElementSchema = z.object({
  id: z.string().min(1),
  type: z.literal("beam"),
  start: point3DSchema,
  end: point3DSchema,
  profileId: z.string().min(1),
  color: z.string().optional(),
  excludeFromPainting: z.boolean().optional(),
  label: z.string().max(120).optional(),
  groupId: z.string().optional(),
  jointStartId: z.string().optional(),
  jointEndId: z.string().optional(),
});

export const elementGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  elementIds: z.array(z.string()),
});

export const jointConnectionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["miter_90", "miter_45", "t_joint", "lap", "butt"]),
  elementIds: z.array(z.string()),
  position: point3DSchema,
  weldLengthMm: z.number().min(0).nullable(),
  cutAngleDeg: z.number().min(0).max(180).optional(),
  trimMode: z.enum(["auto", "miter", "butt", "none"]).optional(),
  primaryElementId: z.string().optional(),
  processingNotes: z.string().max(300).optional(),
});

export const gridSettingsSchema = z.object({
  majorStepMm: z.number().positive(),
  minorStepMm: z.number().positive(),
  snapEnabled: z.boolean(),
  snapToGrid: z.boolean(),
  snapToEndpoints: z.boolean(),
  snapToIntersections: z.boolean(),
  snapToAngles: z.boolean(),
  showGrid: z.boolean(),
  showAxes: z.boolean(),
  showDimensions: z.boolean(),
});

export const displaySettingsSchema = z.object({
  viewMode: z.enum(["2d", "3d"]),
  cameraPreset: z.enum(["isometric", "top", "front", "side"]),
  zoomPercent: z.number().min(10).max(400),
  panOffsetMm: z.object({ x: z.number().finite(), y: z.number().finite() }),
  showJoints: z.boolean(),
  showProfileColors: z.boolean(),
});

export const metalCalcProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Укажите название проекта").max(120),
  description: z.string().max(500).optional(),
  isExample: z.boolean(),
  elements: z.array(constructionElementSchema),
  groups: z.array(elementGroupSchema),
  profiles: z.array(materialProfileSchema),
  joints: z.array(jointConnectionSchema),
  calculationSettings: calculationSettingsSchema,
  gridSettings: gridSettingsSchema,
  displaySettings: displaySettingsSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
