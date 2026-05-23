// Booking flow URL contract:
//   /book?step=purpose|jewelry|slot|contact&purpose=...&items=...&slot=...
//
// Each step reads + advances the searchParams via plain GET forms (no
// client state needed). The final "Подтвердить" button POSTs to a server
// action that runs the transaction and redirects to /book/success.

export type BookingPurpose = "appointment" | "jewelry" | "both";
export type BookingStep = "purpose" | "jewelry" | "slot" | "contact";

export const BOOKING_STEP_ORDER: BookingStep[] = [
  "purpose",
  "jewelry",
  "slot",
  "contact",
];

export interface BookingState {
  step: BookingStep;
  purpose: BookingPurpose | null;
  itemIds: string[];
  slotId: string | null;
}

export function parseBookingState(sp: {
  step?: string;
  purpose?: string;
  items?: string;
  slot?: string;
}): BookingState {
  const purpose = isPurpose(sp.purpose) ? sp.purpose : null;
  const itemIds = parseCsv(sp.items);
  const slotId = sp.slot ?? null;

  // Step coerces to a sensible default if missing or invalid.
  let step: BookingStep =
    sp.step && BOOKING_STEP_ORDER.includes(sp.step as BookingStep)
      ? (sp.step as BookingStep)
      : "purpose";

  // Skip steps that don't apply to the chosen purpose.
  if (purpose === "appointment" && step === "jewelry") step = "slot";
  if (purpose === "jewelry" && step === "slot") step = "contact";

  return { step, purpose, itemIds, slotId };
}

export function serializeBookingParams(s: Partial<BookingState>): string {
  const params = new URLSearchParams();
  if (s.step) params.set("step", s.step);
  if (s.purpose) params.set("purpose", s.purpose);
  if (s.itemIds && s.itemIds.length > 0) {
    params.set("items", s.itemIds.join(","));
  }
  if (s.slotId) params.set("slot", s.slotId);
  return params.toString();
}

/** Step-after for navigation. Skips steps that don't apply to the purpose. */
export function nextStep(
  current: BookingStep,
  purpose: BookingPurpose | null,
): BookingStep | null {
  const order = BOOKING_STEP_ORDER;
  let idx = order.indexOf(current);
  if (idx < 0) return null;
  while (idx < order.length - 1) {
    idx += 1;
    const candidate = order[idx];
    if (purpose === "appointment" && candidate === "jewelry") continue;
    if (purpose === "jewelry" && candidate === "slot") continue;
    return candidate;
  }
  return null;
}

export function previousStep(
  current: BookingStep,
  purpose: BookingPurpose | null,
): BookingStep | null {
  const order = BOOKING_STEP_ORDER;
  let idx = order.indexOf(current);
  if (idx <= 0) return null;
  while (idx > 0) {
    idx -= 1;
    const candidate = order[idx];
    if (purpose === "appointment" && candidate === "jewelry") continue;
    if (purpose === "jewelry" && candidate === "slot") continue;
    return candidate;
  }
  return null;
}

function isPurpose(v: unknown): v is BookingPurpose {
  return v === "appointment" || v === "jewelry" || v === "both";
}

/** Single-pass CSV parser used by booking and other URL contracts. */
function parseCsv(s: string | undefined): string[] {
  if (!s) return [];
  const out: string[] = [];
  for (const raw of s.split(",")) {
    const t = raw.trim();
    if (t) out.push(t);
  }
  return out;
}
