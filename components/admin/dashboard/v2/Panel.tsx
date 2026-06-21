"use client";

import type { ReactNode } from "react";
import { SURFACE } from "../shared";
import { AnimatedNumber } from "@/components/admin/form/AnimatedNumber";

/**
 * Shared elevated panel for the v2 dashboard — the SURFACE card with a hairline
 * heading row (uppercase label + an optional spring-counted tally on the right).
 * Padding scales from a phone-friendly base (p-5) up so the panel never crowds
 * its content at 320px. The body is a flex column so list children + a trailing
 * "see all" link lay out predictably.
 */
export function Panel({
  title,
  count,
  children,
  className = "",
}: {
  title: string;
  count?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${SURFACE} flex flex-col p-5 sm:p-6 lg:p-7 ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-ink/10 pb-3">
        <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-mute">
          {title}
        </h2>
        {count != null ? (
          <span className="font-mono text-xs tabular-nums text-mute">
            <AnimatedNumber value={count} countOnMount />
          </span>
        ) : null}
      </div>
      <div className="mt-5 flex flex-1 flex-col">{children}</div>
    </section>
  );
}
