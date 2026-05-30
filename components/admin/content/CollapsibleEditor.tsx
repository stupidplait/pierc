"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/shadcn/ui/card";
import { Reveal } from "@/components/admin/form/atelier";
import { cn } from "@/lib/utils";

/**
 * Scannable list row that expands to its editor in place. Collapsed it shows a
 * one-line summary (title + meta + status badge); clicking the header expands
 * the form below. Replaces the old "every item is a fully-open form" layout on
 * the content tabs so a long list reads as a list, not a wall of forms.
 *
 * Height animates via the `grid-template-rows: 0fr → 1fr` trick (no JS measuring
 * and no effects, so it stays clear of the react-compiler lint), and the
 * collapsed body is `inert` so its fields drop out of tab order.
 */
export function CollapsibleEditor({
  title,
  meta,
  status,
  defaultOpen = false,
  accent = false,
  delay = 0,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  defaultOpen?: boolean;
  accent?: boolean;
  delay?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Reveal delay={delay}>
      <Card className={cn("overflow-hidden", accent && "border-accent/30")}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-ink/[0.03]"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">
              {title}
            </span>
            {meta ? (
              <span className="mt-0.5 block truncate text-xs text-mute">
                {meta}
              </span>
            ) : null}
          </span>
          {status}
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-mute transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>

        <div
          className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
          style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div
              className="border-t border-line px-5 pb-5 pt-5"
              inert={!open || undefined}
            >
              {children}
            </div>
          </div>
        </div>
      </Card>
    </Reveal>
  );
}
