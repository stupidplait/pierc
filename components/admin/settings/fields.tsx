"use client";

import { useActionState } from "react";
import { PhoneInput } from "@/components/ui/PhoneInput";
import {
  updateSettings,
  type ActionState,
} from "@/lib/admin/content-actions";
import { ru } from "@/lib/i18n/ru";
import type { FieldDef, SettingsLike } from "./model";

// Field surface borrowed verbatim from the /account EditProfileDrawer so the
// admin form reads as part of the same Steel Atelier family rather than a stock
// form: hairline border over a near-invisible ink wash, accent focus ring.
export const FIELD =
  "h-11 w-full rounded-xl border border-ink/15 bg-ink/[0.03] px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-mute/60 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30";

export const SAVE_PILL =
  "inline-flex h-11 items-center justify-center rounded-xl bg-ink px-6 text-sm font-medium text-bg transition-colors duration-150 hover:bg-ink/90 active:scale-[0.98] disabled:opacity-50";

/** Wraps the shared `updateSettings` server action with `useActionState`. */
export function useSettingsAction() {
  return useActionState<ActionState, FormData>(updateSettings, undefined);
}

/** Labelled control, layout-agnostic — used by the card and rail variants. */
export function SettingsField({
  field,
  value,
}: {
  field: FieldDef;
  value?: string | null;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${field.full ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-medium text-mute">{field.label}</span>
      <Control field={field} value={value} />
    </label>
  );
}

/** Bare control without its own label — for the dossier's label-left rows. */
export function Control({
  field,
  value,
  id,
}: {
  field: FieldDef;
  value?: string | null;
  id?: string;
}) {
  if (field.phone) {
    return (
      <PhoneInput
        id={id}
        name={field.name}
        defaultValue={value ?? ""}
        autoComplete="tel"
        placeholder={field.placeholder}
        className={FIELD}
      />
    );
  }
  return (
    <input
      id={id}
      name={field.name}
      type={field.type ?? "text"}
      inputMode={field.inputMode}
      autoComplete={field.autoComplete}
      defaultValue={value ?? ""}
      placeholder={field.placeholder}
      className={FIELD}
    />
  );
}

/** Save button + inline status, shared by all three variants. */
export function SaveBar({
  state,
  pending,
  className = "",
}: {
  state: ActionState;
  pending: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-4 ${className}`}>
      <button type="submit" disabled={pending} className={SAVE_PILL}>
        {pending ? "…" : ru.admin.settings.save}
      </button>
      {state ? <InlineStatus state={state} /> : null}
    </div>
  );
}

function InlineStatus({ state }: { state: NonNullable<ActionState> }) {
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

export function ValueOf(initial: SettingsLike, name: FieldDef["name"]): string | null {
  return initial[name] ?? null;
}
