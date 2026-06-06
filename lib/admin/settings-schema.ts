import { z } from "zod";

export const SETTINGS_FIELD_ORDER = [
  "contactEmail",
  "contactPhone",
  "contactAddress",
  "instagramUrl",
  "telegramUrl",
  "telegramChatId",
  "workingHoursHint",
] as const;

export type SettingsFieldName = (typeof SETTINGS_FIELD_ORDER)[number];
export type SettingsFieldErrors = Partial<Record<SettingsFieldName, string>>;

export const SETTINGS_VALIDATION_SUMMARY = "Проверьте поля формы";

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const normalizeUrlInput = (v: unknown) => {
  const u = emptyToUndefined(v);
  if (typeof u !== "string") return u;
  const t = u.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

export const settingsSchema = z.object({
  contactEmail: z.preprocess(
    emptyToUndefined,
    z.string().trim().email("Некорректный email").optional(),
  ),
  contactPhone: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .refine((s) => s.replace(/\D/g, "").length === 11, "Введите телефон полностью")
      .optional(),
  ),
  contactAddress: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  instagramUrl: z.preprocess(
    normalizeUrlInput,
    z.string().url("Некорректная ссылка").optional(),
  ),
  telegramUrl: z.preprocess(
    normalizeUrlInput,
    z.string().url("Некорректная ссылка").optional(),
  ),
  telegramChatId: z.preprocess(
    emptyToUndefined,
    z.string().trim().regex(/^-?\d+$/, "Только цифры").optional(),
  ),
  workingHoursHint: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export function parseSettingsFormData(formData: FormData) {
  return settingsSchema.safeParse(
    Object.fromEntries(
      SETTINGS_FIELD_ORDER.map((name) => [name, formData.get(name)]),
    ),
  );
}

export function settingsFieldErrors(error: z.ZodError): SettingsFieldErrors {
  const out: SettingsFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in out)) {
      out[key as SettingsFieldName] = issue.message;
    }
  }
  return out;
}

export function firstSettingsError(
  errors: SettingsFieldErrors,
): SettingsFieldName | undefined {
  return SETTINGS_FIELD_ORDER.find((name) => errors[name]);
}
