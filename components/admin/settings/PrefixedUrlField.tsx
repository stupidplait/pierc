"use client";

import { type ChangeEvent } from "react";
import { inputClassName } from "@/components/shadcn/ui/input";
import { cn } from "@/lib/utils";

// Compile the strip pattern once per unique prefix (there are only a couple),
// rather than rebuilding a RegExp on every render.
const prefixPatterns = new Map<string, RegExp>();
function prefixPattern(prefix: string): RegExp {
  let re = prefixPatterns.get(prefix);
  if (!re) {
    const host = prefix
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "")
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(`^https?:\\/\\/(www\\.)?${host}\\/?`, "i");
    prefixPatterns.set(prefix, re);
  }
  return re;
}

/** Strip the canonical prefix (scheme-/www-insensitive) to show just the handle. */
function stripPrefix(value: string, prefix: string): string {
  if (!value) return "";
  return value.replace(prefixPattern(prefix), "");
}

/** Recombine the handle into a full URL. A pasted full URL is kept verbatim. */
function toFullUrl(handle: string, prefix: string): string {
  const h = handle.trim();
  if (!h) return "";
  if (/^https?:\/\//i.test(h)) return h;
  return prefix + h.replace(/^\/+/, "");
}

/**
 * A URL field that guards the domain: the `prefix` (e.g. `https://instagram.com/`)
 * is shown fixed and non-editable, and the user only types the handle. The
 * visible input is unnamed; a hidden input carries the full `prefix + handle`
 * URL so the form submits — and the store keeps — a complete, valid URL with no
 * silent server-side reformatting.
 */
export function PrefixedUrlField({
  id,
  name,
  prefix,
  value,
  onValueChange,
  placeholder,
  invalid,
  errorId,
}: {
  id: string;
  name: string;
  prefix: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  errorId?: string;
}) {
  const handle = stripPrefix(value, prefix);
  return (
    <div
      className={cn(
        inputClassName,
        "flex items-center px-0 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30",
        invalid && "border-error ring-2 ring-error/30",
      )}
    >
      <span className="select-none pl-3.5 text-sm text-mute/70" aria-hidden>
        {prefix}
      </span>
      <input
        id={id}
        type="text"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={handle}
        placeholder={placeholder}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onValueChange(toFullUrl(e.currentTarget.value, prefix))
        }
        aria-invalid={invalid ? "true" : undefined}
        aria-describedby={errorId}
        className="min-w-0 flex-1 bg-transparent pr-3.5 text-sm text-ink outline-none placeholder:text-mute/50"
      />
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
