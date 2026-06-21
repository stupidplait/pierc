// Feature flags — single source of truth, read from env at build time.
//
// Flags are exposed via NEXT_PUBLIC_* so the SAME resolved value is available
// in server components, client components, route handlers, and server actions
// without drift. NEXT_PUBLIC vars are statically inlined by Next at build, so
// each flag must reference `process.env.NEXT_PUBLIC_…` as a direct, literal
// property access (which the lines below do).

/**
 * Parse a boolean env flag. Treats the common truthy/falsy spellings; anything
 * unrecognised (or unset / empty) falls back to `fallback`.
 */
function envBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === "") return fallback;
  const v = value.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  return fallback;
}

/**
 * Master switch for ALL Telegram functionality and Telegram-related data on
 * the site. Default ON (preserves existing behaviour); set
 * `NEXT_PUBLIC_TELEGRAM_ENABLED=false` to:
 *   - hide every Telegram link / handle (footers, landing CTA, slot-picker
 *     fallback, /account contact row, admin settings fields, SEO `sameAs`);
 *   - disable the account-linking flow and the bot webhook;
 *   - skip all Telegram notifications (booking, status, cancellation, test).
 *
 * Note: the existing `TELEGRAM_BOT_TOKEN` presence check still gates sends on
 * top of this flag — the flag is a hard kill-switch layered above it.
 */
export const TELEGRAM_ENABLED = envBool(
  process.env.NEXT_PUBLIC_TELEGRAM_ENABLED,
  true,
);

/**
 * Master switch for ALL Instagram data on the site. Default ON. Set
 * `NEXT_PUBLIC_INSTAGRAM_ENABLED=false` to hide every Instagram link / handle
 * (footers, admin settings field, SEO `sameAs`). Instagram has no backend
 * integration — it's purely a contact/social link — so this gates display +
 * stored-data exposure only.
 */
export const INSTAGRAM_ENABLED = envBool(
  process.env.NEXT_PUBLIC_INSTAGRAM_ENABLED,
  true,
);
