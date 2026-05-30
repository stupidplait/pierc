// Steel Atelier admin form class strings — kept in a plain (non-"use client")
// module so Server Components can import the raw strings. Re-exporting them from
// the client `atelier.tsx` instead would hand Server Components a client
// reference, not the actual class string.

// Elevated panel + layered shadow shared with the settings cards and /account.
export const CARD =
  "rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(8,8,8,0.5),0_10px_28px_-10px_rgba(8,8,8,0.6)]";

// Field surface borrowed from the /account drawer: hairline border over a
// barely-there ink wash, accent focus ring. Replaces the old `bg-page` inputs
// that read as holes punched in the card.
export const FIELD =
  "w-full rounded-xl border border-ink/15 bg-ink/3 px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-mute/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30";
export const FIELD_H = `h-11 ${FIELD}`;
export const FIELD_AREA = `${FIELD} py-3 leading-relaxed`;

export const SUBMIT =
  "inline-flex h-11 items-center justify-center rounded-xl bg-ink px-6 text-sm font-medium text-bg transition-colors duration-150 hover:bg-ink/90 active:scale-[0.98] disabled:opacity-50";

// Neutral secondary — hairline pill that firms its border + ink on hover. For
// cancel / reset / back actions that sit beside the ink save pill.
export const GHOST =
  "inline-flex h-11 items-center justify-center rounded-xl border border-ink/15 px-5 text-sm font-medium text-mute transition-colors hover:border-ink/35 hover:text-ink active:scale-[0.98]";

// Neutral ghost that warms to the error tone on hover — for destructive
// actions. Passed to the shared ConfirmDeleteButton so delete reads as
// secondary next to the ink save pill.
export const GHOST_DELETE =
  "inline-flex h-11 items-center justify-center rounded-xl border border-ink/15 px-5 text-sm font-medium text-mute transition-colors hover:border-error/50 hover:text-error active:scale-[0.98]";

export const LABEL = "text-xs font-medium text-mute";
