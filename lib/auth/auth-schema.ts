import { z } from "zod";
import { ru } from "@/lib/i18n/ru";

// ─────────────────────────────────────────────────────────────────────────────
// Shared auth validation — the single source of truth for both the public
// sign-in / sign-up forms (client-side, per-field) AND the `runLogin` /
// `signUpAction` server actions (the real trust boundary). Mirrors the
// `booking-schema.ts` pattern: schemas live in a plain module (not a
// "use server" file, which may only export async functions) so they can be
// imported on the client and unit-tested.
//
// Messages are pulled from the i18n table so client and server speak the same
// language; the `.min(1, …)` "required" check is ordered *before* `.email(…)`
// so an empty field reports "укажите email" rather than "некорректный email".
// ─────────────────────────────────────────────────────────────────────────────

const si = ru.pages.signIn.errors;
const su = ru.pages.signUp.errors;

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, si.emailRequired)
    .email(si.emailInvalid)
    .toLowerCase(),
  // Sign-in only checks presence client-side; the real credential check happens
  // in NextAuth's authorize(). We deliberately do NOT reveal length rules here
  // (no hint about the stored password), and the server collapses every failure
  // into one generic "invalid email or password" message.
  password: z.string().min(1, si.passwordRequired),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(1, su.nameRequired),
  email: z
    .string()
    .trim()
    .min(1, su.emailRequired)
    .email(su.emailInvalid)
    .toLowerCase(),
  password: z.string().min(8, su.passwordTooShort),
  phone: z.string().trim().optional(),
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;

export type AuthMode = "signIn" | "signUp";
export type AuthFieldName = "name" | "email" | "password" | "phone";

const authSchemas = { signIn: signInSchema, signUp: signUpSchema } as const;

/**
 * Validate a single field against its per-mode schema. Returns the first error
 * message, or `null` when the value is valid (or the field doesn't exist in the
 * given mode — e.g. `name`/`phone` in sign-in). Drives the client form's
 * on-blur / on-change validation without round-tripping to the server.
 */
export function validateAuthField(
  mode: AuthMode,
  field: AuthFieldName,
  value: string,
): string | null {
  const shape = authSchemas[mode].shape as Record<string, z.ZodType | undefined>;
  const fieldSchema = shape[field];
  if (!fieldSchema) return null;
  const res = fieldSchema.safeParse(value);
  return res.success ? null : (res.error.issues[0]?.message ?? null);
}
