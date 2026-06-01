import type { ReactNode } from "react";
import Link from "next/link";
import { Card } from "@/components/shadcn/ui/card";

/**
 * Shared master–detail console shell, used by both the appointments and the
 * bookings admin lists so the two read as one family. The left rail is a
 * scrollable, day-grouped list of selectable rows (selection is URL-driven via a
 * `?sel=` href the caller builds); the right pane is the open record's dossier,
 * or a prompt when nothing is selected.
 *
 * Pure server component — no state, no client boundary. Selecting a row is a
 * soft navigation with `scroll={false}` so the page doesn't jump to the top.
 */

export interface ConsoleRailItem {
  id: string;
  /** Status-tone dot class, e.g. "bg-accent". */
  dotClass: string;
  /** Primary line. */
  title: string;
  /** Optional secondary line (muted). */
  subtitle?: string;
  /** Optional right-aligned mono meta (time / price). */
  meta?: string;
}

export interface ConsoleRailGroup {
  key: string;
  label: string;
  items: ConsoleRailItem[];
}

export function ConsoleShell({
  groups,
  selectedId,
  buildSelHref,
  emptyPrompt,
  children,
}: {
  groups: ConsoleRailGroup[];
  selectedId: string | null;
  buildSelHref: (id: string) => string;
  emptyPrompt: string;
  /** The open record's dossier; when absent the empty prompt is shown. */
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[19rem_1fr]">
      {/* ── Left rail: selectable list ───────────────────────────── */}
      <div className="rounded-2xl border border-line bg-card p-2 lg:sticky lg:top-6 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        {groups.map((g) => (
          <div key={g.key} className="mb-1.5 last:mb-0">
            <h2 className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-mute/70">
              {g.label}
            </h2>
            <ul>
              {g.items.map((it) => {
                const active = it.id === selectedId;
                return (
                  <li key={it.id}>
                    <Link
                      href={buildSelHref(it.id)}
                      scroll={false}
                      aria-current={active ? "true" : undefined}
                      className={`relative flex items-center gap-2.5 rounded-lg py-2 pl-3 pr-2.5 transition-colors ${
                        active
                          ? "bg-ink/6 text-ink"
                          : "text-mute hover:bg-ink/3 hover:text-ink"
                      }`}
                    >
                      {active ? (
                        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent" />
                      ) : null}
                      <span
                        className={`size-1.5 shrink-0 rounded-full ${it.dotClass}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {it.title}
                        </span>
                        {it.subtitle ? (
                          <span className="mt-0.5 block truncate text-xs text-mute">
                            {it.subtitle}
                          </span>
                        ) : null}
                      </span>
                      {it.meta ? (
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-mute">
                          {it.meta}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* ── Right pane: dossier ──────────────────────────────────── */}
      {children ?? (
        <Card className="flex h-fit items-center justify-center p-16 text-center">
          <p className="text-sm text-mute">{emptyPrompt}</p>
        </Card>
      )}
    </div>
  );
}
