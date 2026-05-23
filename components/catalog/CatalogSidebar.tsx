"use client";

import Image from "next/image";
import { useMemo } from "react";
import {
  type AnchorWire,
  type BodyPlace,
  type EquippedMap,
  type JewelryWire,
  SOFT_CAP,
} from "@/lib/catalog/types";
import { bodyPlaceLabels, bodyPlaceOrder, catalogStrings } from "@/lib/i18n/ru";
import { formatPrice } from "@/lib/jewelry/format";

interface CatalogSidebarProps {
  anchors: AnchorWire[];
  jewelry: JewelryWire[];
  selectedAnchorId: string | null;
  equipped: EquippedMap;
  /** When at least one piece is equipped, the URL to hand off to the booking flow. */
  bookHref: string | null;
  onSelectAnchor: (id: string | null) => void;
  onEquip: (anchorId: string, jewelryId: string) => void;
  onUnequip: (anchorId: string) => void;
}

export function CatalogSidebar({
  anchors,
  jewelry,
  selectedAnchorId,
  equipped,
  bookHref,
  onSelectAnchor,
  onEquip,
  onUnequip,
}: CatalogSidebarProps) {
  const t = catalogStrings.showroom;

  // Group anchors by place for the <optgroup>s.
  const grouped = useMemo(() => {
    const out = {} as Record<BodyPlace, AnchorWire[]>;
    for (const place of bodyPlaceOrder) out[place] = [];
    for (const a of anchors) out[a.place].push(a);
    return out;
  }, [anchors]);

  // Filtered jewelry list. If no anchor selected, show everything.
  const filtered = useMemo(() => {
    if (!selectedAnchorId) return jewelry;
    return jewelry.filter((j) => j.anchorIds.includes(selectedAnchorId));
  }, [jewelry, selectedAnchorId]);

  // Reverse map for the tray: anchorId -> the equipped jewelry record.
  const equippedItems = useMemo(() => {
    const anchorById = new Map(anchors.map((a) => [a.id, a]));
    const jewelryById = new Map(jewelry.map((j) => [j.id, j]));
    const out: Array<{ anchor: AnchorWire; item: JewelryWire }> = [];
    for (const [anchorId, jewelryId] of Object.entries(equipped)) {
      const anchor = anchorById.get(anchorId);
      const item = jewelryById.get(jewelryId);
      if (anchor && item) out.push({ anchor, item });
    }
    return out;
  }, [equipped, anchors, jewelry]);

  const trayCount = equippedItems.length;
  const limitReached = trayCount >= SOFT_CAP;

  // Equipped jewelry id at the active anchor (used to show "РЎРЅСЏС‚СЊ" on its card).
  const equippedAtActive = selectedAnchorId
    ? equipped[selectedAnchorId]
    : undefined;

  return (
    <aside className="flex h-full flex-col gap-5 overflow-y-auto border-line bg-card/40 p-5 lg:border-l">
      {/* Anchor picker */}
      <label className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-[0.2em] text-mute">
          {t.anchorPickerLabel}
        </span>
        <select
          value={selectedAnchorId ?? ""}
          onChange={(e) => onSelectAnchor(e.target.value || null)}
          className="h-11 rounded-xl border border-line bg-page px-4 text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <option value="">{t.anchorAll}</option>
          {bodyPlaceOrder.map((place) =>
            grouped[place].length > 0 ? (
              <optgroup key={place} label={bodyPlaceLabels[place]}>
                {grouped[place].map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
            ) : null,
          )}
        </select>
      </label>

      {/* Tray (equipped pieces) */}
      <section>
        <header className="mb-2 flex items-baseline justify-between gap-2">
          <h3 className="text-xs uppercase tracking-[0.2em] text-mute">
            {t.trayHeading}
          </h3>
          <span
            className={`text-xs font-medium ${limitReached ? "text-primary" : "text-mute"}`}
          >
            {trayCount}/{SOFT_CAP}
          </span>
        </header>
        {trayCount === 0 ? (
          <p className="text-xs text-mute">
            {t.traySoftCap.replace("{n}", String(SOFT_CAP))}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {equippedItems.map(({ anchor, item }) => (
              <li
                key={anchor.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-page p-2"
              >
                <Thumb url={item.photo} alt={item.name} small />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {item.name}
                  </p>
                  <p className="truncate text-xs text-mute">{anchor.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onUnequip(anchor.id)}
                  className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs text-mute transition-colors hover:border-primary hover:text-primary"
                >
                  Г—
                </button>
              </li>
            ))}
          </ul>
        )}
        {limitReached ? (
          <p className="mt-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">
            {t.trayLimitReached.replace("{n}", String(SOFT_CAP))}
          </p>
        ) : null}
        {bookHref ? (
          <a
            href={bookHref}
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-soft"
          >
            {catalogStrings.bookCta}
          </a>
        ) : null}
      </section>

      {/* Filtered list */}
      <section className="flex-1">
        <header className="mb-2 flex items-baseline justify-between">
          <h3 className="text-xs uppercase tracking-[0.2em] text-mute">
            {selectedAnchorId
              ? anchors.find((a) => a.id === selectedAnchorId)?.name
              : catalogStrings.showroom.anchorAll}
          </h3>
          <span className="text-xs text-mute">
            {filtered.length} {t.pieces}
          </span>
        </header>
        {filtered.length === 0 ? (
          <p className="text-sm text-mute">
            {selectedAnchorId ? t.listEmpty : catalogStrings.empty}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((j) => {
              const isEquippedHere = equippedAtActive === j.id;
              const canEquip = selectedAnchorId !== null;
              const blockedByCap =
                !isEquippedHere && limitReached && !equippedAtActive;
              return (
                <li
                  key={j.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-page p-2 transition-colors hover:border-primary"
                >
                  <Thumb url={j.photo} alt={j.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {j.name}
                    </p>
                    <p className="truncate text-xs text-mute">
                      {j.categoryName} В· {formatPrice(j.price)}
                    </p>
                  </div>
                  {isEquippedHere ? (
                    <button
                      type="button"
                      onClick={() =>
                        selectedAnchorId && onUnequip(selectedAnchorId)
                      }
                      className="shrink-0 rounded-full border border-primary px-3 py-1 text-xs font-medium text-primary"
                    >
                      {t.unequip}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canEquip || blockedByCap}
                      title={
                        !canEquip
                          ? t.listAnchorPrompt
                          : blockedByCap
                            ? t.trayLimitReached.replace(
                                "{n}",
                                String(SOFT_CAP),
                              )
                            : undefined
                      }
                      onClick={() =>
                        selectedAnchorId && onEquip(selectedAnchorId, j.id)
                      }
                      className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-medium text-on-primary transition-opacity disabled:opacity-40"
                    >
                      {t.equip}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </aside>
  );
}

function Thumb({
  url,
  alt,
  small = false,
}: {
  url: string | null;
  alt: string;
  small?: boolean;
}) {
  const size = small ? 36 : 44;
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-lg bg-card`}
      style={{ width: size, height: size }}
    >
      {url ? (
        <Image
          src={url}
          alt={alt}
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      ) : null}
    </div>
  );
}
