import { z } from "zod";

/**
 * Client-safe validation for the content drawer editors (service + FAQ). Lives
 * in a plain module (no "use server") so the drawer forms can run the very same
 * schema in the browser *before* hitting the network — the server action
 * re-validates as the authority. Mirrors the settings page split
 * (lib/admin/settings-schema.ts).
 */

export const CONTENT_VALIDATION_SUMMARY = "Проверьте поля формы";

// ── Service ──────────────────────────────────────────────────────────────────

export const SERVICE_FIELD_ORDER = [
  "name",
  "description",
  "price",
  "durationMin",
] as const;

export type ServiceFieldName = (typeof SERVICE_FIELD_ORDER)[number];
export type ServiceFieldErrors = Partial<Record<ServiceFieldName, string>>;

// `order` is no longer a form field — drag-to-reorder owns it (new rows append,
// reorderServices() persists the sequence). The drawer never touches it.
export const serviceSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Название обязательно"),
  description: z.string().trim().optional().or(z.literal("")),
  price: z.coerce.number().nonnegative("Цена не может быть отрицательной"),
  durationMin: z.coerce
    .number()
    .int("Целое число")
    .positive("Длительность больше 0"),
  published: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

export function parseServiceFormData(formData: FormData) {
  return serviceSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price"),
    durationMin: formData.get("durationMin"),
    published: formData.get("published"),
  });
}

export function serviceFieldErrors(error: z.ZodError): ServiceFieldErrors {
  return collectFieldErrors(error) as ServiceFieldErrors;
}

export function firstServiceError(
  errors: ServiceFieldErrors,
): ServiceFieldName | undefined {
  return SERVICE_FIELD_ORDER.find((name) => errors[name]);
}

// ── FAQ ──────────────────────────────────────────────────────────────────────

export const FAQ_FIELD_ORDER = ["question", "answer"] as const;

export type FaqFieldName = (typeof FAQ_FIELD_ORDER)[number];
export type FaqFieldErrors = Partial<Record<FaqFieldName, string>>;

export const faqSchema = z.object({
  id: z.string().optional(),
  question: z.string().trim().min(1, "Вопрос обязателен"),
  answer: z.string().trim().min(1, "Ответ обязателен"),
  published: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

export function parseFaqFormData(formData: FormData) {
  return faqSchema.safeParse({
    id: formData.get("id") || undefined,
    question: formData.get("question"),
    answer: formData.get("answer"),
    published: formData.get("published"),
  });
}

export function faqFieldErrors(error: z.ZodError): FaqFieldErrors {
  return collectFieldErrors(error) as FaqFieldErrors;
}

export function firstFaqError(errors: FaqFieldErrors): FaqFieldName | undefined {
  return FAQ_FIELD_ORDER.find((name) => errors[name]);
}

// ── shared ─────────────────────────────────────────────────────────────────--

/** First message per field path — matches settingsFieldErrors' behaviour. */
function collectFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in out)) {
      out[key] = issue.message;
    }
  }
  return out;
}
