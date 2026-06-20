"use client";

import type { ReactNode } from "react";
import { motion, MotionConfig } from "framer-motion";
import {
  ENTRANCE_DURATION,
  ENTRANCE_HIDDEN,
  ENTRANCE_SHOW,
  REVEAL_EASE,
} from "@/components/motion/entrance";
import type { ActionState } from "@/lib/admin/content-actions";
import { ru } from "@/lib/i18n/ru";
import { FIELD_AREA, FIELD_H, LABEL, SUBMIT } from "./styles";

/**
 * Steel Atelier admin form kit — the interactive components.
 *
 * The same elevated-card + hairline-field vocabulary the redesigned /admin
 * settings page uses, factored out so the /admin/content editors (about,
 * services, FAQ, gallery) read as part of the one family instead of the old
 * stock-form look. The class strings live in the plain `./styles` module so
 * Server Components can import them too; the components here own the behaviour.
 */

function colSpan(full?: boolean) {
  return full ? "sm:col-span-2" : "";
}

/**
 * Blur-focus entrance, identical to the settings cards / services grid. `delay`
 * lets a server-rendered list stagger itself by passing the row index.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={ENTRANCE_HIDDEN}
        animate={ENTRANCE_SHOW}
        transition={{ duration: ENTRANCE_DURATION, ease: REVEAL_EASE, delay }}
        className={className}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}

/** Display heading + supporting lead, sized like the settings card header. */
export function CardHeader({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="sm:col-span-2">
      <h2 className="font-display text-xl font-medium tracking-tight text-ink">
        {title}
      </h2>
      {lead ? <p className="mt-1 max-w-prose text-sm text-mute">{lead}</p> : null}
    </div>
  );
}

export function Field({
  name,
  label,
  defaultValue,
  required,
  type = "text",
  placeholder,
  full,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  required?: boolean;
  type?: string;
  placeholder?: string;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${colSpan(full)}`}>
      <span className={LABEL}>{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className={FIELD_H}
      />
    </label>
  );
}

export function TextArea({
  name,
  label,
  defaultValue,
  required,
  rows = 4,
  placeholder,
  full,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  required?: boolean;
  rows?: number;
  placeholder?: string;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${colSpan(full)}`}>
      <span className={LABEL}>{label}</span>
      <textarea
        name={name}
        rows={rows}
        required={required}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className={FIELD_AREA}
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
  full,
}: {
  name: string;
  label: string;
  defaultValue?: number | string | null;
  step?: string;
  min?: number;
  max?: number;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${colSpan(full)}`}>
      <span className={LABEL}>{label}</span>
      <input
        type="number"
        name={name}
        step={step}
        min={min}
        max={max}
        defaultValue={defaultValue ?? ""}
        className={FIELD_H}
      />
    </label>
  );
}

export function Select({
  name,
  label,
  defaultValue,
  options,
  placeholder,
  required,
  full,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  options: { value: string; label: string }[];
  /** Rendered as a leading empty-value option (e.g. "— none —"). */
  placeholder?: string;
  required?: boolean;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${colSpan(full)}`}>
      <span className={LABEL}>{label}</span>
      <select
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
        className={FIELD_H}
      >
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

/** Checkbox styled as a Steel Atelier pill switch; submits as a normal checkbox. */
export function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-3 self-end pb-1.5">
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-ink/15 transition-colors duration-150 peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card" />
        <span className="pointer-events-none absolute left-0.5 top-0.5 size-5 rounded-full bg-ink shadow-sm transition-transform duration-150 peer-checked:translate-x-5 peer-checked:bg-bg" />
      </span>
      <span className="text-sm text-ink">{label}</span>
    </label>
  );
}

export function FileField({
  name,
  label,
  accept,
  required,
  multiple,
}: {
  name: string;
  label: string;
  accept?: string;
  required?: boolean;
  multiple?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={LABEL}>{label}</span>
      <input
        type="file"
        name={name}
        accept={accept}
        required={required}
        multiple={multiple}
        aria-label={label}
        className="block w-full rounded-xl border border-ink/15 bg-ink/3 p-2 text-sm text-mute outline-none transition-colors file:mr-4 file:rounded-lg file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-medium file:text-bg hover:file:bg-ink/90 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
      />
    </label>
  );
}

export function SubmitPill({
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
      className={SUBMIT}
    >
      {children}
    </button>
  );
}

/** Inline save status — quiet text, not a full-width banner. Matches settings. */
export function InlineStatus({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.ok) {
    return (
      <span
        role="status"
        aria-live="polite"
        className="text-sm font-medium text-success"
      >
        {state.message ?? ru.admin.common.saved}
      </span>
    );
  }
  return (
    <span role="alert" aria-live="assertive" className="text-sm text-error">
      {state.error}
    </span>
  );
}
