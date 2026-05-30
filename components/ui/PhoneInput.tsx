"use client";

import { useState, type InputHTMLAttributes } from "react";
import { maskRuPhone } from "@/lib/phone";

type BaseInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "type" | "inputMode"
>;

interface PhoneInputProps extends BaseInputProps {
  /** Controlled value. The component re-masks it for display, so passing back
   *  the masked string from `onValueChange` round-trips cleanly. */
  value?: string;
  /** Initial value for uncontrolled use inside a <form> with `name`. */
  defaultValue?: string;
  /** Fires with the masked string on every edit. */
  onValueChange?: (masked: string) => void;
}

/**
 * Phone field that applies the RU +7 (XXX) XXX-XX-XX mask as the user types.
 * Works both controlled (`value` + `onValueChange`) and uncontrolled
 * (`name` + `defaultValue`) — in the latter case it keeps its own masked state
 * while still submitting through the surrounding form via the `name` attribute.
 */
export function PhoneInput({
  value,
  defaultValue,
  onValueChange,
  autoComplete = "tel",
  ...rest
}: PhoneInputProps) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState(() => maskRuPhone(defaultValue ?? ""));
  const shown = controlled ? maskRuPhone(value) : inner;

  return (
    <input
      {...rest}
      type="tel"
      inputMode="tel"
      autoComplete={autoComplete}
      value={shown}
      onChange={(e) => {
        const masked = maskRuPhone(e.target.value);
        if (!controlled) setInner(masked);
        onValueChange?.(masked);
      }}
    />
  );
}
