"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LabThemeToggle } from "./LabThemeToggle";

/**
 * LabChrome — minimal fixed top bar shared by every landing-lab variant:
 *   ← back to the gallery   ·   variant label   ·   light/dark toggle
 *
 * Intentionally near-invisible (transparent, currentColor, blends with mix-blend
 * if the variant sets a text colour on a parent). A variant may restyle via
 * `className` or skip it and compose its own chrome — but every variant MUST
 * surface a back link + a <LabThemeToggle/>.
 */
export function LabChrome({
  no,
  title,
  className = "",
}: {
  no: string;
  title: string;
  className?: string;
}) {
  return (
    <div
      className={
        "pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-4 px-[clamp(16px,3vw,40px)] py-[clamp(14px,2vh,22px)] text-current " +
        className
      }
    >
      <Link
        href="/landing-labs"
        className="pointer-events-auto inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] no-underline opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/60"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Лаборатория
      </Link>

      <span className="hidden select-none text-[11px] font-medium uppercase tracking-[0.22em] opacity-50 sm:inline">
        {no} — {title}
      </span>

      <div className="pointer-events-auto">
        <LabThemeToggle />
      </div>
    </div>
  );
}
