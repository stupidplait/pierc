// ─────────────────────────────────────────────────────────────────────────────
// Russian phone formatting — one source of truth for the +7 (XXX) XXX-XX-XX
// mask used in every input field and every place a number is printed.
//
// All three helpers normalize the trunk/country prefix the same way:
//   • a leading 8 (domestic trunk)  → 7
//   • a 10-digit number with no code → 7-prefixed
//   • a leading 7                    → kept
// so "+7 (905) 123-45-67", "89051234567" and "9051234567" all land identically.
// ─────────────────────────────────────────────────────────────────────────────

/** Strip to digits and coerce the leading trunk/country code to a single "7". */
function toRuTrunk(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits[0] === "8") digits = "7" + digits.slice(1);
  else if (digits[0] !== "7") digits = "7" + digits;
  return digits.slice(0, 11); // 7 + 10 subscriber digits
}

/** Group the 10 subscriber digits into "(XXX) XXX-XX-XX", revealing each
 *  separator only once the digit after it exists (so backspace never sticks). */
function groupSubscriber(rest: string): string {
  let out = "+7";
  if (rest.length > 0) {
    out += " (" + rest.slice(0, 3);
    if (rest.length > 3) {
      out += ") " + rest.slice(3, 6);
      if (rest.length > 6) {
        out += "-" + rest.slice(6, 8);
        if (rest.length > 8) out += "-" + rest.slice(8, 10);
      }
    }
  }
  return out;
}

/**
 * Live input mask. Progressively formats whatever the user has typed so far and
 * is idempotent on an already-masked value. Returns "" for empty input so the
 * field can be fully cleared and its placeholder can show.
 */
export function maskRuPhone(raw: string | null | undefined): string {
  const digits = toRuTrunk(raw ?? "");
  if (digits.length === 0) return "";
  return groupSubscriber(digits.slice(1));
}

/**
 * Display formatter for stored values. Formats recognizable RU numbers (10 or
 * 11 digits) and otherwise returns the original string untouched, so legacy or
 * non-RU data is never mangled. Empty/null → "".
 */
export function formatRuPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 10 && digits.length !== 11) return raw.trim();
  const rest = toRuTrunk(digits).slice(1);
  if (rest.length !== 10) return raw.trim();
  return groupSubscriber(rest);
}

/** Build the value for a `tel:` href — "+7XXXXXXXXXX" for recognizable RU
 *  numbers, best-effort "+<digits>" otherwise. */
export function ruPhoneHref(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return "+" + toRuTrunk(digits);
  return "+" + digits;
}
