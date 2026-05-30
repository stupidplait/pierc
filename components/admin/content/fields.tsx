"use client";

/**
 * Steel Atelier admin field kit built on the shadcn primitives
 * (`components/shadcn/ui`). Same hairline-field vocabulary as the old
 * `components/admin/form` kit, but composed from the shared shadcn
 * Input/Textarea/Label/Switch so the content editors and the catalog editor
 * speak one component language. Each field takes an explicit `id` (derive it
 * from a per-item `useId()`) so labels stay associated when many editors render
 * on the same page.
 */

import type { ReactNode } from "react";
import { Input } from "@/components/shadcn/ui/input";
import { Textarea } from "@/components/shadcn/ui/textarea";
import { Label } from "@/components/shadcn/ui/label";
import { Switch } from "@/components/shadcn/ui/switch";
import { cn } from "@/lib/utils";

type FieldValue = string | number | null | undefined;

function Shell({
  id,
  label,
  full,
  children,
}: {
  id: string;
  label: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", full && "sm:col-span-2")}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export function TextField({
  id,
  name,
  label,
  defaultValue,
  placeholder,
  required,
  full,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: FieldValue;
  placeholder?: string;
  required?: boolean;
  full?: boolean;
}) {
  return (
    <Shell id={id} label={label} full={full}>
      <Input
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
      />
    </Shell>
  );
}

export function TextAreaField({
  id,
  name,
  label,
  defaultValue,
  placeholder,
  required,
  rows = 3,
  full,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: FieldValue;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  full?: boolean;
}) {
  return (
    <Shell id={id} label={label} full={full}>
      <Textarea
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        rows={rows}
      />
    </Shell>
  );
}

export function NumberField({
  id,
  name,
  label,
  defaultValue,
  step,
  min,
  max,
  full,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: FieldValue;
  step?: string;
  min?: number;
  max?: number;
  full?: boolean;
}) {
  return (
    <Shell id={id} label={label} full={full}>
      <Input
        id={id}
        type="number"
        name={name}
        defaultValue={defaultValue ?? ""}
        step={step}
        min={min}
        max={max}
      />
    </Shell>
  );
}

/** Label + shadcn Switch on one hairline row; submits as a native checkbox. */
export function SwitchRow({
  id,
  name,
  label,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink/[0.02] px-3.5 py-2.5 sm:self-end">
      <Label htmlFor={id} className="cursor-pointer text-sm text-ink">
        {label}
      </Label>
      <Switch id={id} name={name} defaultChecked={defaultChecked} />
    </div>
  );
}
