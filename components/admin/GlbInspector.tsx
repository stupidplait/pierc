"use client";

import { useEffect, useState } from "react";
import { GlbPreview, type GlbStats } from "@/components/admin/GlbPreview";
import { ru } from "@/lib/i18n/ru";

/**
 * GlbInspector — the model viewer paired with a facts readout + an actions
 * column, so the wide model panel reads as a proper asset inspector instead of
 * a lone square with dead space to its right.
 *
 *   ┌─────────────┬──────────────────────┐
 *   │             │  Полигоны   1 234     │
 *   │   preview   │  Вершины    2 468     │  ← geometry tally (from the GLB)
 *   │  (orbit/    │  Меши       3         │
 *   │   zoom)     │  Размер     1.2 МБ    │  ← file size (HEAD Content-Length)
 *   │             ├──────────────────────┤
 *   │             │  [actions: open /     │  ← caller-supplied
 *   └─────────────┴──   approve / delete] ─┘
 *
 * Stacks vertically on narrow panels, side-by-side from `sm`.
 */
export function GlbInspector({
  url,
  label,
  highlight,
  actions,
}: {
  url: string;
  /** Optional caption above the preview (e.g. "Новая — на проверке"). */
  label?: string;
  /** Ring the preview in accent (the candidate under review). */
  highlight?: boolean;
  /** Buttons/links for this model — rendered under the facts. */
  actions?: React.ReactNode;
}) {
  const t = ru.admin.jewelry.model;
  const [stats, setStats] = useState<GlbStats | null>(null);
  // Keyed by url so a stale size never shows after the url prop changes —
  // every setState here is async (inside .then), so no setState-in-effect.
  const [size, setSize] = useState<{ url: string; bytes: number } | null>(null);

  // File size via a HEAD — best-effort; the readout just hides the row on failure.
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(url, { method: "HEAD", signal: ctrl.signal })
      .then((res) => {
        const len = res.headers.get("content-length");
        if (len) setSize({ url, bytes: Number(len) });
      })
      .catch(() => {
        /* size is optional — leave it hidden */
      });
    return () => ctrl.abort();
  }, [url]);

  const bytes = size && size.url === url ? size.bytes : null;

  return (
    <figure className="flex flex-col gap-1.5">
      {label ? (
        <figcaption
          className={`text-xs font-medium ${highlight ? "text-accent" : "text-mute"}`}
        >
          {label}
        </figcaption>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <div className="w-full sm:max-w-xs">
          <GlbPreview
            url={url}
            onStats={setStats}
            className={highlight ? "ring-1 ring-accent/40" : ""}
          />
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            <Fact label={t.statTriangles} value={fmt(stats?.triangles)} />
            <Fact label={t.statVertices} value={fmt(stats?.vertices)} />
            <Fact label={t.statMeshes} value={fmt(stats?.meshes)} />
            <Fact label={t.statMaterials} value={fmt(stats?.materials)} />
            {bytes != null ? (
              <Fact label={t.statSize} value={formatBytes(bytes)} />
            ) : null}
          </dl>

          {actions ? (
            <div className="mt-auto flex flex-wrap items-center gap-3">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </figure>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-mute">{label}</dt>
      <dd className="font-medium tabular-nums text-ink">{value}</dd>
    </div>
  );
}

// "—" while the GLB is still loading (stats undefined), grouped thousands once known.
function fmt(n: number | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("ru-RU");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} КБ`;
  return `${(kb / 1024).toFixed(1)} МБ`;
}
