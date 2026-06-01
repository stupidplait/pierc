"use client";

import * as React from "react";
import { Input } from "@/components/shadcn/ui/input";

/**
 * Sanitized numeric field for the admin forms.
 *
 * Built on `type="text"` + `inputMode` rather than `type="number"` on purpose:
 * a native number input reports an empty `.value` while the user is mid-typing
 * an invalid intermediate (`e`, a lone `-`, a second `.`), which makes
 * keystroke-level correction unreliable. A controlled text field lets us own
 * every character — typed OR pasted — so the garbage the studio hit (`03`,
 * `-5`, `1e9`, `2.5` in a stock count, `++e9312`) never lands in the field.
 *
 *   • `mode="integer"` — digits only, no separator (e.g. stock count).
 *   • `mode="decimal"` — digits + a single `.`; a typed `,` is folded to `.`
 *     so the value still parses with `Number()` (the shared Zod schema's coerce).
 *   • Both reject `e`/`E`/`+` and (for non-negative fields) `-` at input time.
 *   • On blur the value is normalized: leading zeros stripped, a trailing
 *     separator dropped, integers floored, and anything below `min` clamped —
 *     all via a single `Number()→String()` round-trip (`"03"→"3"`, `"5."→"5"`,
 *     `"0.50"→"0.5"`). Empty stays empty so optional fields can be left blank.
 *
 * Submits as a native form field via `name`, so the server action reads it with
 * `formData.get(name)` exactly like before.
 */
export interface NumberInputProps {
  name: string;
  id?: string;
  mode?: "decimal" | "integer";
  /** Lower bound enforced on blur. Defaults to 0 (non-negative). */
  min?: number;
  /** Allow a leading minus. Defaults to false (all current fields are ≥ 0). */
  allowNegative?: boolean;
  defaultValue?: string | number | null;
  placeholder?: string;
  /** Trailing unit chip rendered inside the field (₽ / мм / шт.). */
  unit?: string;
  invalid?: boolean;
  "aria-describedby"?: string;
  className?: string;
  /** Fired with the live (sanitized) value on every change — for dirty/clear. */
  onValueChange?: (value: string) => void;
}

function toInitial(v: string | number | null | undefined): string {
  return v == null ? "" : String(v);
}

/** Strip characters that can't belong in the field as the user types/pastes. */
function sanitize(
  raw: string,
  mode: "decimal" | "integer",
  allowNegative: boolean,
): string {
  // Fold a decimal comma to a dot so RU-keyboard input still parses.
  let s = mode === "decimal" ? raw.replace(/,/g, ".") : raw;

  // Keep only the legal alphabet for this mode.
  const allowed = mode === "integer" ? /[^\d-]/g : /[^\d.-]/g;
  s = s.replace(allowed, "");

  // Minus: only a single leading one, and only when permitted.
  if (allowNegative) {
    const neg = s.startsWith("-");
    s = (neg ? "-" : "") + s.replace(/-/g, "");
  } else {
    s = s.replace(/-/g, "");
  }

  // Decimal: collapse to a single separator (the first one wins).
  if (mode === "decimal") {
    const dot = s.indexOf(".");
    if (dot !== -1) {
      s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
    }
  }

  // Strip leading zeros as they're typed (not just on blur), so "003829" never
  // lands in the field. A single leading zero is kept only when it's the whole
  // value ("0") or guards a decimal point ("0.5") — both legal.
  s = s.replace(/^(-?)0+(\d)/, "$1$2");

  return s;
}

/** Final clean-up once focus leaves: normalize form + clamp to `min`. */
function normalizeOnBlur(
  s: string,
  mode: "decimal" | "integer",
  min: number,
): string {
  if (s === "" || s === "." || s === "-" || s === "-.") return "";
  const trimmed = s.endsWith(".") ? s.slice(0, -1) : s;
  let n = Number(trimmed);
  if (!Number.isFinite(n)) return "";
  if (mode === "integer") n = Math.trunc(n);
  if (n < min) n = min;
  // Number→String drops leading zeros and redundant trailing zeros for us.
  return String(n);
}

export function NumberInput({
  name,
  id,
  mode = "decimal",
  min = 0,
  allowNegative = false,
  defaultValue,
  placeholder,
  unit,
  invalid = false,
  "aria-describedby": describedBy,
  className = "",
  onValueChange,
}: NumberInputProps) {
  const [value, setValue] = React.useState<string>(() =>
    toInitial(defaultValue),
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = sanitize(e.target.value, mode, allowNegative);
    setValue(next);
    onValueChange?.(next);
  };

  const handleBlur = () => {
    const normalized = normalizeOnBlur(value, mode, min);
    if (normalized !== value) {
      setValue(normalized);
      onValueChange?.(normalized);
    }
  };

  return (
    <span className="relative block">
      <Input
        id={id}
        name={name}
        type="text"
        inputMode={mode === "integer" ? "numeric" : "decimal"}
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`${unit ? "pr-11" : ""} ${className}`}
      />
      {unit ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-mute"
        >
          {unit}
        </span>
      ) : null}
    </span>
  );
}
