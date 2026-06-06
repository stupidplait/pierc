"use client";

import { type ChangeEvent } from "react";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { Input, inputClassName } from "@/components/shadcn/ui/input";
import { Label } from "@/components/shadcn/ui/label";
import type { FieldDef } from "./model";
import { FieldError } from "./FieldError";
import { PrefixedUrlField } from "./PrefixedUrlField";
import { TelegramTestLink } from "./TelegramTestLink";

function keepDigits(el: HTMLInputElement) {
  const negative = el.value.trim().startsWith("-");
  const cleaned = (negative ? "-" : "") + el.value.replace(/\D/g, "");
  if (cleaned !== el.value) el.value = cleaned;
}

export function SettingsField({
  field,
  value,
  error,
  onValueChange,
}: {
  field: FieldDef;
  value: string;
  error?: string;
  onValueChange: (value: string) => void;
}) {
  const id = `settings-${field.name}`;
  const errorId = `${id}-error`;
  const invalid = Boolean(error);
  const structured =
    field.type === "email" || field.type === "url" || Boolean(field.digitsOnly);
  return (
    <div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <Label htmlFor={id}>{field.label}</Label>
          {field.testTelegram ? <TelegramTestLink chatId={value} /> : null}
        </div>
        {field.prefix ? (
          <PrefixedUrlField
            id={id}
            name={field.name}
            prefix={field.prefix}
            value={value}
            onValueChange={onValueChange}
            placeholder={field.placeholder}
            invalid={invalid}
            errorId={invalid ? errorId : undefined}
          />
        ) : field.phone ? (
          <PhoneInput
            id={id}
            name={field.name}
            defaultValue={value}
            onValueChange={onValueChange}
            placeholder={field.placeholder}
            autoComplete="tel"
            className={inputClassName}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
          />
        ) : (
          <Input
            id={id}
            name={field.name}
            type={field.type ?? "text"}
            inputMode={field.inputMode}
            autoComplete={field.autoComplete}
            defaultValue={value}
            placeholder={field.placeholder}
            spellCheck={structured ? false : undefined}
            autoCapitalize={structured ? "none" : undefined}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              if (field.digitsOnly) keepDigits(e.currentTarget);
              onValueChange(e.currentTarget.value);
            }}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
          />
        )}
      </div>
      <FieldError id={errorId} error={error} />
    </div>
  );
}
