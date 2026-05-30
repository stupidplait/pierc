"use client";

import { ru } from "@/lib/i18n/ru";
import { AppointmentAccordion, FeedItemContent } from "./parts";
import { FeedHeading, GroupLabel } from "./shared";
import { itemKey, type FeedVariantProps } from "./types";

const t = ru.pages.account;

// ── Account feed (spotlight + history) ───────────────────────────────────────
// Strongest hierarchy: the one thing that matters now — the next appointment —
// gets a large spotlight panel with its countdown promoted to a display-size
// number; everything else collapses into a tight, scannable history list below.
export function Feed({
  feed,
  nextEntry,
  nextCountdownLabel,
  total,
}: FeedVariantProps) {
  return (
    <>
      <FeedHeading label={t.activityHeading} count={total} />

      {/* Spotlight — the next appointment, or a quiet placeholder. */}
      {nextEntry ? (
        <div className="mt-8 rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/8 to-transparent p-6 sm:p-7">
          {nextCountdownLabel ? (
            <p className="mb-4 font-display text-3xl font-medium tracking-tight text-accent sm:text-4xl">
              {nextCountdownLabel}
            </p>
          ) : null}
          <AppointmentAccordion entry={nextEntry} pinned />
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-line p-6 text-sm text-mute sm:p-7">
          {t.noUpcoming}
        </div>
      )}

      {/* History — compact rows, no rail. */}
      {feed.length > 0 ? (
        <div className="mt-8 flex flex-col gap-4">
          <GroupLabel>{t.sectionPast}</GroupLabel>
          <ul className="flex flex-col divide-y divide-ink/10 rounded-xl border border-line">
            {feed.map((e) => (
              <li key={itemKey(e)} className="px-4 py-3.5 sm:px-5">
                <FeedItemContent item={e} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
