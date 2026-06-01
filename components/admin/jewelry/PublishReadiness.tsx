"use client";

import { ArrowRight, Check, Circle } from "lucide-react";

/**
 * Publish-readiness primitives for the jewelry editor.
 *
 * Replaces the old flat `PublishChecklist`. Two pieces of pure presentation —
 * a progress ring and a grouped, *navigable* checklist — that the editor
 * composes into three interchangeable placements (a pill on the tab row, a
 * slim strip under the header, a card on the main tab). The form owns the data
 * (it computes each row live from its field snapshot) and the navigation (each
 * row hands its `tab`/`field` back so the form can switch tabs and focus the
 * offending control). Nothing here reaches into form state.
 */

export type ReadinessTab = "attributes" | "anchors" | "photos" | "model";

export interface ReadinessItem {
  /** Stable identity for the row. */
  key: string;
  label: string;
  done: boolean;
  /** `required` rows gate a save; `recommended` rows only enrich the card. */
  kind: "required" | "recommended";
  /** Tab that owns this item — clicking the row switches to it. */
  tab: ReadinessTab;
  /** Optional control id to focus once that tab is shown (attribute fields). */
  field?: string;
  /** Optional trailing count, e.g. anchors selected so far. */
  count?: number;
}

export type ReadinessTone = "warn" | "accent" | "success";

/**
 * Overall tone, in priority order: any required row missing → `warn` (blocks a
 * save); else any recommended row missing → `accent` (savable, not yet rich);
 * else `success` (ready to publish).
 */
export function readinessTone(items: ReadinessItem[]): ReadinessTone {
  if (items.some((i) => i.kind === "required" && !i.done)) return "warn";
  if (items.some((i) => i.kind === "recommended" && !i.done)) return "accent";
  return "success";
}

const RING_TRACK = "stroke-ink/15";
const RING_FILL: Record<ReadinessTone, string> = {
  warn: "stroke-warn",
  accent: "stroke-accent",
  success: "stroke-success",
};
const TONE_TEXT: Record<ReadinessTone, string> = {
  warn: "text-warn",
  accent: "text-accent",
  success: "text-success",
};

/**
 * Circular progress meter. Fill fraction = `done / total`; colour reflects the
 * caller-supplied tone. Renders a centred tick once every row is complete.
 */
export function ReadinessRing({
  done,
  total,
  tone,
  size = 20,
  className = "",
}: {
  done: number;
  total: number;
  tone: ReadinessTone;
  size?: number;
  className?: string;
}) {
  const stroke = size >= 26 ? 2.5 : 2;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const frac = total > 0 ? done / total : 0;
  const complete = total > 0 && done >= total;
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className={RING_TRACK}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={`${RING_FILL[tone]} transition-[stroke-dashoffset] duration-300`}
          style={{ strokeDasharray: circ, strokeDashoffset: circ * (1 - frac) }}
        />
      </svg>
      {complete ? (
        <Check
          className={`absolute ${TONE_TEXT[tone]}`}
          style={{ width: size * 0.5, height: size * 0.5 }}
          aria-hidden
        />
      ) : null}
    </span>
  );
}

export interface ChecklistLabels {
  groupRequired: string;
  groupRecommended: string;
  requiredHint: string;
  recommendedHint: string;
  /** Prefix for each row's aria-label, e.g. "Перейти: Цена". */
  jumpTo: string;
}

/** One navigable row — a button that jumps to the field it tracks. */
function Row({
  item,
  onJump,
  jumpTo,
  missingClass,
}: {
  item: ReadinessItem;
  onJump: (item: ReadinessItem) => void;
  jumpTo: string;
  /** Tone for an *incomplete* row (warn for required, mute for recommended). */
  missingClass: string;
}) {
  const tone = item.done ? "text-ink/70" : missingClass;
  const label =
    item.count != null ? `${item.label} · ${item.count}` : item.label;
  return (
    <button
      type="button"
      onClick={() => onJump(item)}
      aria-label={`${jumpTo}: ${item.label}`}
      className={`group/row flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-ink/5 focus-visible:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/30 ${tone}`}
    >
      {item.done ? (
        <Check className="size-4 shrink-0 text-success" aria-hidden />
      ) : (
        <Circle className="size-4 shrink-0 text-mute/40" aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ArrowRight
        className="size-3.5 shrink-0 -translate-x-1 text-mute opacity-0 transition-all group-hover/row:translate-x-0 group-hover/row:opacity-100 group-focus-visible/row:translate-x-0 group-focus-visible/row:opacity-100"
        aria-hidden
      />
    </button>
  );
}

function Group({
  title,
  hint,
  items,
  onJump,
  jumpTo,
  missingClass,
}: {
  title: string;
  hint: string;
  items: ReadinessItem[];
  onJump: (item: ReadinessItem) => void;
  jumpTo: string;
  missingClass: string;
}) {
  if (items.length === 0) return null;
  const remaining = items.filter((i) => !i.done).length;
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2 px-2">
        <span className="text-xs font-medium uppercase tracking-wide text-mute">
          {title}
        </span>
        <span className="text-xs text-mute/60">
          {remaining > 0 ? hint : null}
        </span>
      </div>
      <div className="grid gap-x-4 sm:grid-cols-2">
        {items.map((it) => (
          <Row
            key={it.key}
            item={it}
            onJump={onJump}
            jumpTo={jumpTo}
            missingClass={missingClass}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The grouped, navigable checklist body. Shared verbatim by all three editor
 * placements — only the chrome around it (pill / strip / card) differs.
 */
export function ReadinessChecklist({
  items,
  onJump,
  labels,
  className = "",
}: {
  items: ReadinessItem[];
  onJump: (item: ReadinessItem) => void;
  labels: ChecklistLabels;
  className?: string;
}) {
  const required = items.filter((i) => i.kind === "required");
  const recommended = items.filter((i) => i.kind === "recommended");
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <Group
        title={labels.groupRequired}
        hint={labels.requiredHint}
        items={required}
        onJump={onJump}
        jumpTo={labels.jumpTo}
        missingClass="text-warn"
      />
      <Group
        title={labels.groupRecommended}
        hint={labels.recommendedHint}
        items={recommended}
        onJump={onJump}
        jumpTo={labels.jumpTo}
        missingClass="text-mute"
      />
    </div>
  );
}
