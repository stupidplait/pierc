// Per-route glyphs for the admin sidebar rail — one icon per nav destination,
// keyed by href. All decorative (aria-hidden); the link's label supplies the
// accessible name. Drawn on a 18×18 grid with a 1.5 stroke so they sit a touch
// heavier than the 16px quick-action glyphs and read clearly at rail size.

import type { ReactElement, SVGProps } from "react";

const common: SVGProps<SVGSVGElement> = {
  width: 18,
  height: 18,
  viewBox: "0 0 18 18",
  fill: "none",
  "aria-hidden": true,
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

// dashboard — a 2×2 panel grid
function DashboardGlyph() {
  return (
    <svg {...common}>
      <rect x="2.5" y="2.5" width="5" height="5" rx="1" />
      <rect x="10.5" y="2.5" width="5" height="5" rx="1" />
      <rect x="2.5" y="10.5" width="5" height="5" rx="1" />
      <rect x="10.5" y="10.5" width="5" height="5" rx="1" />
    </svg>
  );
}

// jewelry catalogue — a faceted gem
function GemGlyph() {
  return (
    <svg {...common}>
      <path d="M3.5 7 6 3.5h6L14.5 7 9 15.5 3.5 7Z" />
      <path d="M3.5 7h11M6 3.5 9 7l3-3.5M9 7v8.5" />
    </svg>
  );
}

// slots — a calendar
function CalendarGlyph() {
  return (
    <svg {...common}>
      <rect x="3" y="4" width="12" height="11" rx="1.5" />
      <path d="M3 7.5h12M6.5 2.5V5M11.5 2.5V5" />
    </svg>
  );
}

// bookings — a reservation tag
function TagGlyph() {
  return (
    <svg {...common}>
      <path d="M9 2.5H4A1.5 1.5 0 0 0 2.5 4v5l6.6 6.6a1.5 1.5 0 0 0 2.1 0l3.4-3.4a1.5 1.5 0 0 0 0-2.1L9 2.5Z" />
      <circle cx="6" cy="6" r=".75" fill="currentColor" stroke="none" />
    </svg>
  );
}

// appointments — a clock
function ClockGlyph() {
  return (
    <svg {...common}>
      <circle cx="9" cy="9" r="6.5" />
      <path d="M9 5.5V9l2.5 1.5" />
    </svg>
  );
}

// reviews — a star
function StarGlyph() {
  return (
    <svg {...common}>
      <path d="M9 2.2 10.59 6.82 15.47 6.9 11.57 9.83 13 14.5 9 11.7 5 14.5 6.43 9.83 2.53 6.9 7.41 6.82 9 2.2Z" />
    </svg>
  );
}

// content — a document with text lines
function DocGlyph() {
  return (
    <svg {...common}>
      <rect x="4" y="2.5" width="10" height="13" rx="1.5" />
      <path d="M6.5 6.5h5M6.5 9.5h5M6.5 12.5h3" />
    </svg>
  );
}

// settings — a gear
function GearGlyph() {
  return (
    <svg {...common}>
      <circle cx="9" cy="9" r="2.4" />
      <path d="M9 1.7v2M9 14.3v2M16.3 9h-2M3.7 9h-2M14.16 3.84l-1.4 1.4M5.24 12.76l-1.4 1.4M14.16 14.16l-1.4-1.4M5.24 5.24l-1.4-1.4" />
    </svg>
  );
}

const BY_HREF: Record<string, () => ReactElement> = {
  "/admin": DashboardGlyph,
  "/admin/jewelry": GemGlyph,
  "/admin/slots": CalendarGlyph,
  "/admin/bookings": TagGlyph,
  "/admin/appointments": ClockGlyph,
  "/admin/reviews": StarGlyph,
  "/admin/content": DocGlyph,
  "/admin/settings": GearGlyph,
};

/** Route glyph for a sidebar link. Falls back to the gear for any unmapped href. */
export function NavIcon({ href }: { href: string }) {
  const Glyph = BY_HREF[href] ?? GearGlyph;
  return <Glyph />;
}
