/**
 * Client-safe metadata + types for the parametric jewelry generator.
 *
 * Kept SEPARATE from `lib/admin/parametric-glb.ts` (which pulls in three.js +
 * @gltf-transform, both Node-only) so the admin form can import the shape/field
 * descriptors without dragging those heavy server modules into the client bundle.
 * The builder imports its types from here; the form imports the descriptors.
 */

export type MaterialColor =
  | "titanium"
  | "gold-585"
  | "rose-gold-585"
  | "black-pvd";
export type GemColor = "clear" | "pink" | "blue" | "opal-white";

export type ParametricShape =
  | "seamless_hoop"
  | "straight_barbell"
  | "curved_barbell"
  | "horseshoe"
  | "labret_stud"
  | "nose_stud_l";

export interface ShapeField {
  key: string;
  labelRu: string;
  kind: "number" | "topShape" | "gemColor";
  default?: number;
  min?: number;
  max?: number;
  step?: number;
  /** When set, the field only applies for these `topShape` values. */
  showWhenTop?: string[];
}

export interface ShapeDef {
  shape: ParametricShape;
  labelRu: string;
  fields: ShapeField[];
}

const GAUGE: ShapeField = {
  key: "gaugeMm",
  labelRu: "Толщина (gauge), мм",
  kind: "number",
  default: 1.2,
  min: 0.6,
  max: 3,
  step: 0.1,
};

export const PARAMETRIC_SHAPES: ShapeDef[] = [
  {
    shape: "seamless_hoop",
    labelRu: "Кольцо (бесшовное)",
    fields: [
      { key: "diameterMm", labelRu: "Диаметр, мм", kind: "number", default: 8, min: 5, max: 20, step: 0.5 },
      GAUGE,
    ],
  },
  {
    shape: "straight_barbell",
    labelRu: "Прямая штанга",
    fields: [
      { key: "shaftLengthMm", labelRu: "Длина штанги, мм", kind: "number", default: 14, min: 4, max: 40, step: 0.5 },
      { ...GAUGE, default: 1.6 },
      { key: "ballSizeMm", labelRu: "Размер шарика, мм", kind: "number", default: 4, min: 1.5, max: 8, step: 0.5 },
    ],
  },
  {
    shape: "curved_barbell",
    labelRu: "Изогнутая штанга (банан)",
    fields: [
      { key: "shaftLengthMm", labelRu: "Длина, мм", kind: "number", default: 10, min: 6, max: 20, step: 0.5 },
      { ...GAUGE, default: 1.6 },
      { key: "ballSizeMm", labelRu: "Размер шарика, мм", kind: "number", default: 4, min: 1.5, max: 8, step: 0.5 },
      { key: "bowDepthMm", labelRu: "Изгиб, мм", kind: "number", default: 1.5, min: 0, max: 4, step: 0.25 },
    ],
  },
  {
    shape: "horseshoe",
    labelRu: "Подкова (циркулярная штанга)",
    fields: [
      { key: "diameterMm", labelRu: "Диаметр, мм", kind: "number", default: 10, min: 6, max: 20, step: 0.5 },
      { ...GAUGE, default: 1.6 },
      { key: "ballSizeMm", labelRu: "Размер шарика, мм", kind: "number", default: 3, min: 1.5, max: 6, step: 0.5 },
      { key: "gapDegrees", labelRu: "Зазор, °", kind: "number", default: 90, min: 30, max: 150, step: 5 },
    ],
  },
  {
    shape: "labret_stud",
    labelRu: "Лабрет (гвоздик с плоской спинкой)",
    fields: [
      { key: "shaftLengthMm", labelRu: "Длина штифта, мм", kind: "number", default: 8, min: 4, max: 14, step: 0.5 },
      GAUGE,
      { key: "discDiameterMm", labelRu: "Диаметр спинки, мм", kind: "number", default: 3, min: 2, max: 6, step: 0.5 },
      { key: "topShape", labelRu: "Верх", kind: "topShape" },
      { key: "topSizeMm", labelRu: "Размер верха, мм", kind: "number", default: 3, min: 1.5, max: 8, step: 0.5 },
      { key: "topGemColor", labelRu: "Цвет камня", kind: "gemColor", showWhenTop: ["gem"] },
    ],
  },
  {
    shape: "nose_stud_l",
    labelRu: "Нострил (L-образный)",
    fields: [
      { key: "visibleLengthMm", labelRu: "Видимая длина, мм", kind: "number", default: 3.5, min: 2, max: 6, step: 0.5 },
      { key: "insideLengthMm", labelRu: "Внутренняя длина, мм", kind: "number", default: 5.5, min: 3, max: 9, step: 0.5 },
      { ...GAUGE, default: 1.0 },
      { key: "topShape", labelRu: "Верх", kind: "topShape" },
      { key: "topSizeMm", labelRu: "Размер верха, мм", kind: "number", default: 2.5, min: 1.5, max: 6, step: 0.5 },
      { key: "topGemColor", labelRu: "Цвет камня", kind: "gemColor", showWhenTop: ["gem"] },
    ],
  },
];

export const MATERIAL_COLOR_OPTIONS: { value: MaterialColor; labelRu: string }[] = [
  { value: "titanium", labelRu: "Титан G23" },
  { value: "gold-585", labelRu: "Золото 585" },
  { value: "rose-gold-585", labelRu: "Розовое золото 585" },
  { value: "black-pvd", labelRu: "Чёрный PVD" },
];

export const GEM_COLOR_OPTIONS: { value: GemColor; labelRu: string }[] = [
  { value: "clear", labelRu: "Прозрачный" },
  { value: "pink", labelRu: "Розовый" },
  { value: "blue", labelRu: "Синий" },
  { value: "opal-white", labelRu: "Опал (белый)" },
];

/** topShape options for labret/nose stud forms. */
export const TOP_SHAPE_OPTIONS: { value: string; labelRu: string; shapes: ParametricShape[] }[] = [
  { value: "ball", labelRu: "Шарик", shapes: ["labret_stud", "nose_stud_l"] },
  { value: "disc", labelRu: "Диск", shapes: ["labret_stud"] },
  { value: "gem", labelRu: "Камень", shapes: ["labret_stud", "nose_stud_l"] },
];
