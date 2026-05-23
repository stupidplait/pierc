"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  type AnchorWire,
  type EquippedMap,
  type JewelryWire,
} from "@/lib/catalog/types";
import { ru } from "@/lib/i18n/ru";
import { formatPrice } from "@/lib/jewelry/format";
import { serializeEquipped } from "@/lib/catalog/url-state";

interface StoryChapter1Props {
  featured: JewelryWire[];
  anchors: AnchorWire[];
  initialEquipped: EquippedMap;
}

export function StoryChapter1({
  featured,
  anchors,
  initialEquipped,
}: StoryChapter1Props) {
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [equipped, setEquipped] = useState<EquippedMap>(initialEquipped);

  const anchorIdToSlug = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of anchors) m.set(a.id, a.slug);
    return m;
  }, [anchors]);

  const t = ru.pages.home.ch1;

  // Which featured jewelry IDs are currently equipped?
  const equippedJewelryIds = useMemo(
    () => new Set(Object.values(equipped)),
    [equipped],
  );

  const syncUrl = useCallback(
    (next: EquippedMap) => {
      const params = new URLSearchParams(searchParams.toString());
      const eqStr = serializeEquipped(next, anchorIdToSlug);
      if (eqStr) params.set("eq", eqStr);
      else params.delete("eq");
      const qs = params.toString();
      startTransition(() => {
        replace(qs ? `/?${qs}` : "/", { scroll: false });
      });
    },
    [anchorIdToSlug, replace, searchParams],
  );

  const toggle = useCallback(
    (jewelry: JewelryWire) => {
      // First compatible anchor — that's the auto-equip target.
      const anchorId = jewelry.anchorIds[0];
      if (!anchorId) return;

      setEquipped((prev) => {
        const next: EquippedMap = { ...prev };

        // If already equipped (anywhere), remove it.
        const existingAnchor = Object.entries(prev).find(
          ([, jId]) => jId === jewelry.id,
        )?.[0];
        if (existingAnchor) {
          delete next[existingAnchor];
        } else {
          next[anchorId] = jewelry.id;
        }
        syncUrl(next);
        return next;
      });
    },
    [syncUrl],
  );

  const selectedCount = Object.keys(equipped).length;

  return (
    <section
      id="story-ch1"
      className="flex min-h-screen flex-col justify-center gap-8 px-6 py-16 sm:px-8 sm:py-20"
    >
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">
          {t.eyebrow}
        </p>
        <h2 className="mt-3 font-display text-4xl font-medium text-balance text-ink sm:text-5xl">
          {t.title}
        </h2>
        <p className="mt-3 text-balance text-mute">{t.lead}</p>
      </header>

      {featured.length === 0 ? (
        <p className="mx-auto max-w-md text-center text-mute">{t.empty}</p>
      ) : (
        <ul className="mx-auto grid w-full max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((j) => {
            const checked = equippedJewelryIds.has(j.id);
            const out = j.inStock <= 0;
            const cantEquip = !j.anchorIds[0];
            return (
              <li key={j.id}>
                <button
                  type="button"
                  onClick={() => toggle(j)}
                  disabled={out || cantEquip}
                  className={`group flex w-full flex-col overflow-hidden rounded-2xl border transition-colors ${
                    checked
                      ? "border-primary bg-primary/5"
                      : "border-line bg-page hover:border-primary/40"
                  } ${out || cantEquip ? "opacity-60" : ""}`}
                >
                  <div className="relative aspect-[4/5] bg-card">
                    {j.photo ? (
                      <Image
                        src={j.photo}
                        alt={j.name}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover"
                      />
                    ) : null}
                    {checked ? (
                      <span className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full bg-primary text-on-primary text-sm">
                        ✓
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-start justify-between gap-3 p-4 text-left">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-medium text-ink">
                        {j.name}
                      </h3>
                      <p className="truncate text-xs text-mute">
                        {j.categoryName}
                      </p>
                    </div>
                    <p className="shrink-0 text-base font-medium text-primary">
                      {formatPrice(j.price)}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm">
        <p className="text-mute">
          {t.selected.replace("{n}", String(selectedCount))}
        </p>
        <a
          href="#story-ch2"
          className="inline-flex h-11 items-center rounded-full bg-primary px-6 font-medium text-on-primary transition-colors hover:bg-primary-soft"
        >
          {t.next} →
        </a>
        <Link
          href="/catalog"
          className="text-mute transition-colors hover:text-primary"
        >
          {t.skip}
        </Link>
      </footer>
    </section>
  );
}
