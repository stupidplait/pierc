"use client";

/**
 * Steel Atelier admin field kit for the content drawer editors (service + FAQ),
 * built on the shadcn primitives (`components/shadcn/ui`). Fields are fully
 * CONTROLLED (`value` + `onChange`): the parent owns the typed value, so the
 * input survives React 19's automatic `<form action>` reset on a failed submit.
 * (`defaultValue` does NOT — React only writes it on mount, so a reset reverts
 * to the mount value, which is exactly the "price snaps back" bug.) `error`
 * paints the control invalid and reveals an inline, animated message. Each field
 * takes an explicit `id` (derive it from a per-item `useId()`).
 */

import type { ChangeEvent, ReactNode } from "react";
import { AnimatePresence, m } from "framer-motion";
import { Input } from "@/components/shadcn/ui/input";
import { Textarea } from "@/components/shadcn/ui/textarea";
import { Label } from "@/components/shadcn/ui/label";
import { Switch } from "@/components/shadcn/ui/switch";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Inline field error — height/opacity/blur reveal, mirrors settings' FieldError. */
export function FieldError({ id, error }: { id: string; error?: string }) {
  return (
    <AnimatePresence initial={false}>
      {error ? (
        <m.p
          key="error"
          id={id}
          role="alert"
          // Spacing is an animated marginTop (0↔6), NOT padding: with
          // box-sizing:border-box a `height:0` element still floors at its
          // padding height, leaving a sliver that snaps shut. margin has no such
          // floor, so the error collapses to truly nothing.
          initial={{ opacity: 0, height: 0, marginTop: 0, filter: "blur(4px)" }}
          animate={{ opacity: 1, height: "auto", marginTop: 6, filter: "blur(0px)" }}
          exit={{ opacity: 0, height: 0, marginTop: 0, filter: "blur(4px)" }}
          transition={{ duration: 0.24, ease: EASE }}
          className="overflow-hidden text-xs text-error"
        >
          {error}
        </m.p>
      ) : null}
    </AnimatePresence>
  );
}

function Shell({
  id,
  label,
  full,
  error,
  errorId,
  children,
}: {
  id: string;
  label: string;
  full?: boolean;
  error?: string;
  errorId: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(full && "sm:col-span-2")}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        {children}
      </div>
      <FieldError id={errorId} error={error} />
    </div>
  );
}

export function TextField({
  id,
  name,
  label,
  value,
  onValueChange,
  error,
  placeholder,
  required,
  full,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  full?: boolean;
}) {
  const errorId = `${id}-error`;
  return (
    <Shell id={id} label={label} full={full} error={error} errorId={errorId}>
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onValueChange(e.currentTarget.value)
        }
        placeholder={placeholder}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
    </Shell>
  );
}

export function TextAreaField({
  id,
  name,
  label,
  value,
  onValueChange,
  error,
  placeholder,
  required,
  rows = 3,
  full,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  full?: boolean;
}) {
  const errorId = `${id}-error`;
  return (
    <Shell id={id} label={label} full={full} error={error} errorId={errorId}>
      <Textarea
        id={id}
        name={name}
        value={value}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
          onValueChange(e.currentTarget.value)
        }
        placeholder={placeholder}
        required={required}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
    </Shell>
  );
}

export function NumberField({
  id,
  name,
  label,
  value,
  onValueChange,
  error,
  placeholder,
  step,
  min,
  max,
  required,
  full,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  step?: string;
  min?: number;
  max?: number;
  required?: boolean;
  full?: boolean;
}) {
  const errorId = `${id}-error`;
  return (
    <Shell id={id} label={label} full={full} error={error} errorId={errorId}>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        name={name}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onValueChange(e.currentTarget.value)
        }
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
    </Shell>
  );
}

/**
 * Label + shadcn Switch on one hairline row; submits as a native checkbox.
 * Controlled so the toggle survives React 19's `<form action>` reset alongside
 * the snapshot-controlled text fields.
 */
export function SwitchRow({
  id,
  name,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  name: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink/2 px-3.5 py-2.5 sm:self-end">
      <Label htmlFor={id} className="cursor-pointer text-sm text-ink">
        {label}
      </Label>
      <Switch
        id={id}
        name={name}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
