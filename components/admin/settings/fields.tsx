"use client";

import { useActionState } from "react";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { Input } from "@/components/shadcn/ui/input";
import { Label } from "@/components/shadcn/ui/label";
import {
  updateSettings,
  type ActionState,
} from "@/lib/admin/content-actions";
import type { FieldDef } from "./model";

// PhoneInput renders a bare <input>, so it needs the shadcn-Input surface
// spelled out to read identically to the other controls in the form family
// (hairline border over a barely-there ink wash, accent focus ring).
const PHONE_FIELD =
  "h-11 w-full rounded-xl border border-ink/15 bg-ink/3 px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-mute/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30";

/** Wraps the shared `updateSettings` server action with `useActionState`. */
export function useSettingsAction() {
  return useActionState<ActionState, FormData>(updateSettings, undefined);
}

/**
 * One labelled control. Built on the shadcn `Label` + `Input` (and the masked
 * `PhoneInput` for the phone field), so every settings field shares the catalog
 * editor's control vocabulary. Spans both grid columns when `field.full`.
 */
export function SettingsField({
  field,
  value,
}: {
  field: FieldDef;
  value?: string | null;
}) {
  const id = `settings-${field.name}`;
  return (
    <div className={`flex flex-col gap-1.5 ${field.full ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={id}>{field.label}</Label>
      {field.phone ? (
        <PhoneInput
          id={id}
          name={field.name}
          defaultValue={value ?? ""}
          placeholder={field.placeholder}
          autoComplete="tel"
          className={PHONE_FIELD}
        />
      ) : (
        <Input
          id={id}
          name={field.name}
          type={field.type ?? "text"}
          inputMode={field.inputMode}
          autoComplete={field.autoComplete}
          defaultValue={value ?? ""}
          placeholder={field.placeholder}
        />
      )}
    </div>
  );
}
