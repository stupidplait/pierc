"use client";

import { catalogStrings } from "@/lib/i18n/ru";

interface LiteBannerProps {
  /** Pieces with a `spriteUrl` (eligible for try-on). */
  eligibleCount: number;
  /** Total published pieces. */
  totalCount: number;
  /** Active view mode — drives the toggle button label. */
  view: "tryon" | "grid";
  /** Toggle to "Все украшения" grid view (or back). */
  onToggle: () => void;
}

/**
 * Banner shown above the lite-mode catalog. Surfaces the eligibility
 * count so visitors understand why the try-on list might be smaller
 * than the full catalog, and exposes a "Все украшения" toggle that
 * swaps the right-side panel from `<CatalogSidebar>` to
 * `<CatalogGridFallback>` for browsing the full catalog.
 *
 * See docs/15-lite-mode.md F9.
 */
export function LiteBanner({
  eligibleCount,
  totalCount,
  view,
  onToggle,
}: LiteBannerProps) {
  const t = catalogStrings.liteMode.banner;
  const showEligibility = view === "tryon";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-card px-4 py-3 text-sm">
      {showEligibility ? (
        <p className="text-mute">
          {t.eligibility
            .replace("{x}", String(eligibleCount))
            .replace("{y}", String(totalCount))}
        </p>
      ) : (
        <p className="text-mute">{t.gridIntro}</p>
      )}
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex h-9 items-center rounded-full border border-line bg-page px-4 text-xs font-medium text-ink transition-colors hover:border-primary hover:text-primary"
      >
        {view === "tryon" ? t.allPiecesButton : t.backToTryOn}
      </button>
    </div>
  );
}
