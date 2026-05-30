// Small shared glyphs + atoms for the dashboard variants. All decorative
// (aria-hidden) — the surrounding link/heading supplies the accessible name.

// Pinging accent dot — the same "needs attention" motif as /account's next
// appointment. Used by urgent metrics across the variants.
export function PingDot() {
  return (
    <span aria-hidden className="relative inline-flex size-2 shrink-0">
      <span className="absolute -inset-1 animate-ping rounded-full bg-accent/50" />
      <span className="relative block size-2 rounded-full bg-accent" />
    </span>
  );
}

// Static warn dot — the amber low-stock marker. A round dot (not a diamond), and
// unlike PingDot it stays still: low stock is a standing condition, not a live
// alert, so it doesn't pulse.
export function WarnGlyph() {
  return (
    <span aria-hidden className="block size-2 shrink-0 rounded-full bg-warn" />
  );
}

export function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M3 8h9M9 5l3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ExitIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6 14H3.5A1.5 1.5 0 0 1 2 12.5v-9A1.5 1.5 0 0 1 3.5 2H6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M10 11l3-3-3-3M13 8H6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Quick-action glyphs (status board left rail). Keyed by the action href tail.
export function ActionIcon({ kind }: { kind: string }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 16 16",
    fill: "none",
    "aria-hidden": true,
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (kind === "jewelry") {
    return (
      <svg {...common}>
        <path d="M8 2v12M2 8h12" />
      </svg>
    );
  }
  if (kind === "slots") {
    return (
      <svg {...common}>
        <rect x="2.5" y="3" width="11" height="10.5" rx="1.5" />
        <path d="M2.5 6.5h11M5.5 2v2.5M10.5 2v2.5" />
      </svg>
    );
  }
  if (kind === "content") {
    return (
      <svg {...common}>
        <path d="M3 3h10M3 7h10M3 11h6" />
      </svg>
    );
  }
  if (kind === "bookings") {
    // tag — jewelry reservations
    return (
      <svg {...common}>
        <path d="M8 2H3v5l6.5 6.5a1.5 1.5 0 0 0 2.1 0l2.9-2.9a1.5 1.5 0 0 0 0-2.1L8 2Z" />
        <circle cx="5.5" cy="4.5" r=".6" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (kind === "appointments") {
    // clock — appointment slots
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="6" />
        <path d="M8 4.5V8l2.5 1.5" />
      </svg>
    );
  }
  // settings — gear-ish
  return (
    <svg {...common}>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.5v1.8M8 12.7v1.8M14.5 8h-1.8M3.3 8H1.5M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3M12.6 12.6l-1.3-1.3M4.7 4.7 3.4 3.4" />
    </svg>
  );
}
