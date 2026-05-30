import type { ReactNode } from "react";
import { PhoneInput } from "@/components/ui/PhoneInput";

const inputBase =
  "h-11 w-full rounded-xl border border-line bg-page px-4 text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30";

export function TextField({
  name,
  label,
  defaultValue,
  required,
  type = "text",
  placeholder,
  inputMode,
  autoComplete,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  required?: boolean;
  type?: string;
  placeholder?: string;
  inputMode?: "text" | "tel" | "email" | "url" | "numeric" | "decimal";
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        className={inputBase}
      />
    </label>
  );
}

/** Phone variant of TextField — submits via `name` while applying the RU
 *  +7 (XXX) XXX-XX-XX live mask. */
export function PhoneField({
  name,
  label,
  defaultValue,
  required,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink">{label}</span>
      <PhoneInput
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className={inputBase}
      />
    </label>
  );
}

export function TextAreaField({
  name,
  label,
  defaultValue,
  required,
  rows = 6,
  placeholder,
  autoComplete,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  required?: boolean;
  rows?: number;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink">{label}</span>
      <textarea
        name={name}
        rows={rows}
        required={required}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-line bg-page px-4 py-3 text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
      />
    </label>
  );
}

export function NumberField({
  name,
  label,
  defaultValue,
  step,
  min,
  max,
}: {
  name: string;
  label: string;
  defaultValue?: number | string | null;
  step?: string;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        type="number"
        name={name}
        step={step}
        min={min}
        max={max}
        defaultValue={defaultValue ?? ""}
        className={inputBase}
      />
    </label>
  );
}

export function SelectField({
  name,
  label,
  defaultValue,
  options,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  options: { value: string; label: string }[];
  /** Rendered as a leading empty-value option (e.g. "— none —"). */
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink">{label}</span>
      <select name={name} defaultValue={defaultValue ?? ""} className={inputBase}>
        {placeholder !== undefined ? (
          <option value="">{placeholder}</option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CheckboxField({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="size-5 rounded border-line text-primary focus:ring-primary"
      />
      <span className="text-sm font-medium text-ink">{label}</span>
    </label>
  );
}

export function FormStatus({
  state,
}: {
  state:
    | { ok: true; message?: string }
    | { ok: false; error: string }
    | undefined;
}) {
  if (!state) return null;
  if (state.ok) {
    return (
      <p
        role="status"
        aria-live="polite"
        className="rounded-lg border border-success/40 bg-success-soft px-4 py-2 text-sm text-success"
      >
        {state.message ?? "Готово"}
      </p>
    );
  }
  return (
    <p
      role="alert"
      aria-live="assertive"
      className="rounded-lg border border-error/40 bg-error-soft px-4 py-2 text-sm text-error"
    >
      {state.error}
    </p>
  );
}

export function PrimarySubmit({
  children,
  pending,
  formAction,
}: {
  children: ReactNode;
  pending?: boolean;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      formAction={formAction}
      className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 font-medium text-on-primary transition-colors hover:bg-primary-soft focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page outline-none disabled:opacity-50"
    >
      {children}
    </button>
  );
}
