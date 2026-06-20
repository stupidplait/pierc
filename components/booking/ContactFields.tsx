"use client";

import { ru } from "@/lib/i18n/ru";
import { maskRuPhone } from "@/lib/phone";
import { PhoneInput } from "@/components/ui/PhoneInput";
import type { BookingUser } from "@/lib/booking/wizard-types";

export interface ContactValues {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

// Seed the contact form from the signed-in user's profile. The fields stay
// editable — a customer may be booking for someone else, or correcting a typo
// in their saved details — so this is a starting point, not a lock.
export function initialContact(user?: BookingUser | null): ContactValues {
  return {
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: maskRuPhone(user?.phone ?? ""),
    notes: "",
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Required-field gate shared with the submit buttons so the wizard and the
// drawer agree on what "ready to book" means. Mirrors the server-side Zod
// rules in lib/booking/actions.ts.
export function isContactValid(v: ContactValues): boolean {
  return (
    v.name.trim().length > 0 &&
    EMAIL_RE.test(v.email.trim()) &&
    v.phone.trim().length >= 3
  );
}

interface ContactFieldsProps {
  values: ContactValues;
  onChange: (patch: Partial<ContactValues>) => void;
  /**
   * `"full"` shows every field. `"phoneNotes"` hides name + email (a signed-in
   * customer already has them on file — the parent still submits them via its
   * hidden inputs) and surfaces a small "Бронируем как …" caption instead.
   */
  mode?: "full" | "phoneNotes";
}

// The contact inputs shared by the wizard and the drawer. These are *display*
// inputs only (no `name` attribute): the parent owns the values in state and
// submits them via always-present hidden inputs, so a field can never be left
// out of the FormData just because its wizard step is mid-animation.
export function ContactFields({
  values,
  onChange,
  mode = "full",
}: ContactFieldsProps) {
  const t = ru.pages.book.contactStep;
  const compact = mode === "phoneNotes";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {compact ? (
        <p className="text-sm text-mute sm:col-span-2">
          {ru.pages.book.form.bookingAs.replace("{name}", values.name)}
          {values.email ? (
            <span className="text-mute"> · {values.email}</span>
          ) : null}
        </p>
      ) : (
        <>
          <Field
            label={t.nameLabel}
            required
            autoComplete="name"
            placeholder={t.namePlaceholder}
            value={values.name}
            onChange={(v) => onChange({ name: v })}
          />
          <Field
            label={t.emailLabel}
            required
            type="email"
            autoComplete="email"
            placeholder={t.emailPlaceholder}
            value={values.email}
            onChange={(v) => onChange({ email: v })}
          />
        </>
      )}
      <Field
        label={t.phoneLabel}
        required
        phone
        autoComplete="tel"
        placeholder={t.phonePlaceholder}
        className="sm:col-span-2"
        value={values.phone}
        onChange={(v) => onChange({ phone: v })}
      />
      <Field
        label={t.notesLabel}
        textarea
        autoComplete="off"
        placeholder={t.notesPlaceholder}
        className="sm:col-span-2"
        value={values.notes}
        onChange={(v) => onChange({ notes: v })}
      />
    </div>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  inputMode?: "text" | "tel" | "email" | "url" | "numeric" | "decimal";
  textarea?: boolean;
  /** Render a RU phone field with the +7 (XXX) XXX-XX-XX live mask. */
  phone?: boolean;
  placeholder?: string;
  className?: string;
  value: string;
  onChange: (value: string) => void;
}

function Field({
  label,
  required,
  type,
  autoComplete,
  inputMode,
  textarea,
  phone,
  placeholder,
  className,
  value,
  onChange,
}: FieldProps) {
  const inputCls =
    "h-11 w-full rounded-xl border border-line bg-card px-4 text-ink outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30";
  const textareaCls =
    "min-h-24 w-full rounded-xl border border-line bg-card px-4 py-3 text-ink outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30";
  return (
    <label className={`flex flex-col gap-2 ${className ?? ""}`}>
      <span className="text-sm font-medium text-ink">
        {label}
        {required ? <span className="text-primary"> *</span> : null}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={textareaCls}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-required={required || undefined}
        />
      ) : phone ? (
        <PhoneInput
          value={value}
          onValueChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={inputCls}
          aria-required={required || undefined}
        />
      ) : (
        <input
          type={type ?? "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          className={inputCls}
          aria-required={required || undefined}
        />
      )}
    </label>
  );
}
