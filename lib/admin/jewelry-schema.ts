// Shared validation for the catalog editor (create/edit a jewelry piece).
//
// Plain module (no "use server"/"use client" directive) so BOTH the client form
// and the server action import the *same* schema. The client runs it for
// instant per-field feedback; the server re-runs it as the authority (a
// category deleted mid-edit, a hand-forged POST, etc.). They can never disagree
// because there is one parse function.

import { z } from "zod";
import type { JewelryType } from "@/lib/catalog/types";

// ─────────────────────────────────────────────────────────────────────────────
// Enums + per-type anchor rules
// ─────────────────────────────────────────────────────────────────────────────

export const STATUSES = [
  "DRAFT",
  "PROCESSING",
  "PENDING_REVIEW",
  "PUBLISHED",
  "REJECTED",
] as const;

export const JEWELRY_TYPES = [
  "STUD",
  "RING",
  "BARBELL",
  "CIRCULAR_BARBELL",
  "ORBITAL",
  "CHAIN_LADDER",
] as const;

// Same rule as the seed — keep the form-side and seed-side validation in sync.
// See prisma/seed.ts → EXPECTED_ATTACH and docs/20-multi-anchor-jewelry.md.
export const ATTACH_RULES: Record<
  (typeof JEWELRY_TYPES)[number],
  { min: number; max: number; semantics: "compat-list" | "fixed" }
> = {
  STUD: { min: 1, max: 99, semantics: "compat-list" },
  RING: { min: 1, max: 99, semantics: "compat-list" },
  BARBELL: { min: 2, max: 2, semantics: "fixed" },
  CIRCULAR_BARBELL: { min: 2, max: 2, semantics: "fixed" },
  ORBITAL: { min: 2, max: 2, semantics: "fixed" },
  CHAIN_LADDER: { min: 2, max: 8, semantics: "fixed" },
};

function anchorCountMessage(type: JewelryType, picked: number): string {
  const rule = ATTACH_RULES[type];
  const expected =
    rule.min === rule.max ? `${rule.min}` : `${rule.min}–${rule.max}`;
  return `Тип «${type}» требует ${expected} якор(ей), выбрано ${picked}.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const numberFromInput = (msg: string) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number({ error: msg }).positive(msg).optional(),
  );

export const jewelrySchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "Укажите название"),
    description: z.string().trim().optional(),
    categoryId: z.string().min(1, "Выберите категорию"),
    type: z.enum(JEWELRY_TYPES, { error: "Выберите тип украшения" }),
    material: z.string().trim().min(1, "Укажите материал"),
    gauge: numberFromInput("Калибр должен быть положительным числом"),
    size: numberFromInput("Размер должен быть положительным числом"),
    color: z.string().trim().optional(),
    stones: z.string().trim().optional(),
    price: z.coerce
      .number({ error: "Укажите цену числом" })
      .nonnegative("Цена не может быть отрицательной"),
    inStock: z.coerce
      .number({ error: "Укажите остаток числом" })
      .int("Остаток должен быть целым числом")
      .nonnegative("Остаток не может быть отрицательным"),
    status: z.enum(STATUSES, { error: "Выберите статус" }),
    featured: z.preprocess((v) => v === "on" || v === true, z.boolean()),
    anchorIds: z.array(z.string()).default([]),
  })
  .superRefine((v, ctx) => {
    const rule = ATTACH_RULES[v.type];
    if (v.anchorIds.length < rule.min || v.anchorIds.length > rule.max) {
      ctx.addIssue({
        code: "custom",
        message: anchorCountMessage(v.type, v.anchorIds.length),
        path: ["anchorIds"],
      });
    }
  });

export type JewelryInput = z.infer<typeof jewelrySchema>;
export type JewelryField = keyof JewelryInput;

// ─────────────────────────────────────────────────────────────────────────────
// FormData → schema input (the one extraction both sides share)
// ─────────────────────────────────────────────────────────────────────────────

// Strip empty strings -> undefined so optional fields stay null in DB.
function emptyToUndef(v: FormDataEntryValue | null): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length === 0 ? undefined : s;
}

function readAnchorIds(formData: FormData): string[] {
  const out: string[] = [];
  for (const v of formData.getAll("anchorIds")) {
    const s = String(v);
    if (s) out.push(s);
  }
  return out;
}

export function parseJewelryFormData(formData: FormData) {
  return jewelrySchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    description: emptyToUndef(formData.get("description")),
    categoryId: formData.get("categoryId"),
    type: formData.get("type") ?? "STUD",
    material: formData.get("material"),
    gauge: formData.get("gauge"),
    size: formData.get("size"),
    color: emptyToUndef(formData.get("color")),
    stones: emptyToUndef(formData.get("stones")),
    price: formData.get("price"),
    inStock: formData.get("inStock"),
    status: formData.get("status") ?? "DRAFT",
    featured: formData.get("featured"),
    anchorIds: readAnchorIds(formData),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Error shaping + field → tab routing (so the form can flip to the bad field)
// ─────────────────────────────────────────────────────────────────────────────

export type FieldErrors = Partial<Record<JewelryField, string>>;

// Top-level banner shown beside the save button when any field is invalid; the
// specific messages render inline under each field, so this stays generic.
export const VALIDATION_SUMMARY = "Проверьте выделенные поля.";

/** First message per field, in the schema's declared key order. */
export function fieldErrorsFromZod(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in out)) {
      out[key as JewelryField] = issue.message;
    }
  }
  return out;
}

export type JewelryTab = "attributes" | "anchors";

// Which editor tab owns each field — used to surface the first error's tab.
export const FIELD_TAB: Record<JewelryField, JewelryTab> = {
  id: "attributes",
  name: "attributes",
  description: "attributes",
  categoryId: "attributes",
  type: "attributes",
  material: "attributes",
  gauge: "attributes",
  size: "attributes",
  color: "attributes",
  stones: "attributes",
  price: "attributes",
  inStock: "attributes",
  status: "attributes",
  featured: "attributes",
  anchorIds: "anchors",
};

// Declaration order = visual order; used to pick the *first* errored field/tab.
export const FIELD_ORDER: JewelryField[] = [
  "name",
  "description",
  "categoryId",
  "type",
  "material",
  "color",
  "gauge",
  "size",
  "stones",
  "price",
  "inStock",
  "status",
  "featured",
  "anchorIds",
];

export function firstErrorField(errors: FieldErrors): JewelryField | undefined {
  return FIELD_ORDER.find((f) => errors[f]);
}
