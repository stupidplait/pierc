"use client";

import { useState, useTransition } from "react";
import { Sparkles, Check, Loader2 } from "lucide-react";
import {
  analyzeJewelryScale,
  applyJewelryScale,
} from "@/lib/admin/jewelry-actions";

/**
 * Inline scale control for the GLB inspector / candidate review.
 *
 *   Масштаб  ✨ Авто
 *   [ 0.0200 ]  [✓]
 *
 * "Авто" measures the model (the generation candidate when `candidateJobId` is
 * set, otherwise the published one — see analyzeJewelryScale) and FILLS the input
 * with the suggestion — it does NOT save; the studio reviews it and commits with
 * "Применить". The commit is disabled until the value actually differs from the
 * current scale. `compact` swaps the text "Применить" for an icon-only button so
 * it fits a facts-grid cell.
 */
export function ScaleField({
  jewelryId,
  currentScale,
  candidateJobId,
  compact,
}: {
  jewelryId: string;
  currentScale: number;
  /** When set, "Авто" measures THIS generation candidate, not the published model. */
  candidateJobId?: string;
  /** Tight icon-only commit (no "Применить" text) for embedding in a grid cell. */
  compact?: boolean;
}) {
  const [value, setValue] = useState(currentScale.toFixed(4));
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(value);
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= 100;
  // Disable the commit until the value really changes (and is valid / not busy).
  const canApply =
    valid && parsed.toFixed(4) !== currentScale.toFixed(4) && !busy;

  const apply = (scale: string) => {
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("id", jewelryId);
      fd.set("scale", scale);
      const res = await applyJewelryScale(undefined, fd);
      if (res && res.ok === false) setError(res.error);
    });
  };

  const runAuto = () => {
    setError(null);
    start(async () => {
      const r = await analyzeJewelryScale(jewelryId, candidateJobId);
      if (!r.ok) {
        setError(r.error ?? "Не удалось измерить модель");
        return;
      }
      if (r.suggestedScale == null) {
        setError("Укажите размер или толщину украшения для авто-подбора");
        return;
      }
      // Only fill the input with the suggestion — don't save. "Применить" lights
      // up (value changed) and the studio commits after reviewing.
      setValue(r.suggestedScale.toFixed(4));
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Label line owns the auto-suggest helper — it fills the field. */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-mute">Масштаб</span>
        <button
          type="button"
          onClick={runAuto}
          disabled={busy}
          title="Подобрать масштаб автоматически по размеру/толщине"
          className="inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent/80 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          Авто
        </button>
      </div>
      {/* Value line owns the manual commit. */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          step="0.0001"
          min="0.0001"
          max="100"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (canApply) apply(value);
            }
          }}
          disabled={busy}
          aria-label="Масштаб модели"
          className={
            compact
              ? "h-8 w-20 rounded-md border border-ink/15 bg-card px-2 font-mono text-xs tabular-nums text-ink outline-none transition-colors focus:border-ink/40 disabled:opacity-50"
              : "h-9 w-28 rounded-lg border border-ink/15 bg-card px-2.5 font-mono text-sm tabular-nums text-ink outline-none transition-colors focus:border-ink/40 disabled:opacity-50"
          }
        />
        {compact ? (
          <button
            type="button"
            onClick={() => apply(value)}
            disabled={!canApply}
            title="Применить"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-ink text-bg transition-colors hover:bg-ink/90 disabled:opacity-40 disabled:pointer-events-none"
          >
            <Check className="size-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => apply(value)}
            disabled={!canApply}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-medium text-bg transition-colors hover:bg-ink/90 disabled:opacity-40 disabled:pointer-events-none"
          >
            <Check className="size-3.5" />
            Применить
          </button>
        )}
      </div>
      {error ? <span className="text-xs text-error">{error}</span> : null}
    </div>
  );
}
