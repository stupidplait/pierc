// Curated option lists for the catalog editor (material / colour / stones).
//
// These columns are free-text in the DB (Jewelry.material/color/stones), but
// the admin form shouldn't make someone type them blind. The Comboboxes
// preload these lists; material/colour also allow a typed-in one-off, and
// stones is multi-select joined back into the same comma string the column
// already stores ("Циркон, Опал"). Adding a common value here is a one-line
// edit — promote to a DB lookup table later if studio staff need to self-serve.
//
// Seed values mirror the existing pieces in prisma/seed-data/jewelry.json so
// the dropdowns match real inventory out of the box.

export interface CatalogOption {
  value: string;
  label: string;
  /** Optional CSS colour for a swatch dot (colour list only). */
  swatch?: string;
}

export const MATERIALS: CatalogOption[] = [
  { value: "Титан G23", label: "Титан G23" },
  { value: "Титан с PVD-покрытием", label: "Титан с PVD-покрытием" },
  { value: "Золото 585", label: "Золото 585" },
  { value: "Розовое золото 585", label: "Розовое золото 585" },
  { value: "Белое золото 585", label: "Белое золото 585" },
  { value: "Хирургическая сталь 316L", label: "Хирургическая сталь 316L" },
  { value: "Серебро 925", label: "Серебро 925" },
  { value: "Биопласт", label: "Биопласт" },
];

export const COLORS: CatalogOption[] = [
  { value: "Серебристый", label: "Серебристый", swatch: "#c7c9cc" },
  { value: "Золотой", label: "Золотой", swatch: "#d4af37" },
  { value: "Розовое золото", label: "Розовое золото", swatch: "#e6b9a6" },
  { value: "Чёрный", label: "Чёрный", swatch: "#1a1a1a" },
  { value: "Радужный (PVD)", label: "Радужный (PVD)", swatch: "#8a7fb5" },
  { value: "Синий (PVD)", label: "Синий (PVD)", swatch: "#3a6ea5" },
];

export const STONES: CatalogOption[] = [
  { value: "Циркон", label: "Циркон" },
  { value: "Циркон розовый", label: "Циркон розовый" },
  { value: "Циркон голубой", label: "Циркон голубой" },
  { value: "Опал", label: "Опал" },
  { value: "Бриллиант", label: "Бриллиант" },
  { value: "Аметист", label: "Аметист" },
  { value: "Без камней", label: "Без камней" },
];
