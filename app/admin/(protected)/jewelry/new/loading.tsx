// Jewelry creation loading skeleton. Without this per-segment override the
// create route falls back to the catalog list's loading.tsx (hero + status strip
// + list rows), which is the wrong shape. This mirrors
// app/admin/(protected)/jewelry/new/page.tsx + components/admin/JewelryForm on
// its default "attributes" tab: top section (title → tab bar) → attributes card
// (field grid + publication block) → command bar.
// It's the edit skeleton minus the delete control: the create page renders
// JewelryForm WITHOUT a deleteSlot (nothing to delete yet), so the command bar
// is progress · save-state · back + save — no leading delete button.
// Convention (matches the dashboard/catalog skeletons): bare blocks on the page
// use bg-card; blocks sitting inside a card surface use bg-ink/10.

import { CARD } from "@/components/admin/form/styles";

// Tab pill widths so the bar reads like real labels, not identical bars:
// Атрибуты · Места · Фото · 3D-модель.
const TAB_WIDTHS = ["w-24", "w-20", "w-16", "w-28"];

/** Label bar + control block, stacked — mirrors the form's LabeledField. */
function Field({ full, area }: { full?: boolean; area?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <div className="h-3.5 w-20 animate-pulse rounded bg-ink/10" />
      <div
        className={`${area ? "h-20" : "h-11"} animate-pulse rounded-xl bg-ink/10`}
      />
    </div>
  );
}

export default function Loading() {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-6xl pt-2 sm:pt-4">
      <div className="flex flex-col gap-6">
        {/* Top section — title + tabs (progress lives in the command bar). */}
        <div className="flex flex-col gap-4">
          <div className="h-10 w-64 max-w-full animate-pulse rounded-2xl bg-card sm:h-11" />
          <div className="inline-flex w-fit flex-wrap gap-1 rounded-xl border border-line bg-card p-1">
            {TAB_WIDTHS.map((w, i) => (
              <div
                key={i}
                className={`h-8 ${w} animate-pulse rounded-lg bg-ink/10`}
              />
            ))}
          </div>
        </div>

        {/* Attributes card — the default tab. */}
        <div className={`${CARD} p-6 sm:p-8`}>
          <div className="mb-7 h-6 w-32 animate-pulse rounded-lg bg-ink/10" />

          {/* Field grid — name + description span both columns. */}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field full />
            <Field full area />
            {Array.from({ length: 6 }).map((_, i) => (
              <Field key={i} />
            ))}
            <Field full />
            <Field />
            <Field />
          </div>

          {/* Publication block — heading + lead over a status / featured row. */}
          <div className="mt-8 border-t border-line pt-6">
            <div className="mb-5">
              <div className="h-4 w-40 animate-pulse rounded bg-ink/10" />
              <div className="mt-2 h-3.5 w-64 max-w-full animate-pulse rounded bg-ink/10" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field />
              {/* featured switch + label, baseline-aligned with the select. */}
              <div className="flex items-center gap-3 self-end pb-1.5">
                <div className="h-6 w-11 animate-pulse rounded-full bg-ink/10" />
                <div className="h-4 w-28 animate-pulse rounded bg-ink/10" />
              </div>
            </div>
          </div>
        </div>

        {/* Command bar — compact progress · save-state · back + save. No delete
            (the create page renders JewelryForm without a deleteSlot). */}
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-card/95 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="h-11 w-20 animate-pulse rounded-xl bg-ink/10" />
          <div className="flex-1" />
          <div className="h-11 w-24 animate-pulse rounded-xl bg-ink/10" />
          <div className="h-11 w-28 animate-pulse rounded-xl bg-ink/10" />
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        Загрузка…
      </p>
    </div>
  );
}
