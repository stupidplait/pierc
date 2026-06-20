"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { LiteInventoryPanel } from "@/components/catalog/LiteInventoryPanel";
import { CatalogGridFallback } from "@/components/catalog/CatalogGridFallback";
import { JewelryBookingDrawer } from "@/components/booking/JewelryBookingDrawer";
import { LiteBanner } from "./LiteBanner";
import { SelfieCanvas } from "./SelfieCanvas";
import { SelfieDropzone } from "./SelfieDropzone";
import {
  type AnchorWire,
  type EquippedMap,
  type JewelryWire,
  SOFT_CAP,
} from "@/lib/catalog/types";
import type { BookingUser, WizardJewelry } from "@/lib/booking/wizard-types";
import { serializeEquipped } from "@/lib/catalog/url-state";
import { catalogStrings } from "@/lib/i18n/ru";
import type {
  DragOffsetMap,
  PixelPoint,
} from "@/lib/lite/types";

interface LiteModeProps {
  /** All anchors known to the catalog. */
  anchors: AnchorWire[];
  /** All published jewelry. We filter to `spriteUrl != null` for the try-on list. */
  jewelry: JewelryWire[];
  /** URL-derived equipped state. */
  initialEquipped: EquippedMap;
  /** URL-derived selected anchor. */
  initialSelectedId: string | null;
  /** Pathname for URL syncing. Same contract as Showroom. */
  pathname?: string;
  /** Signed-in user, used to prefill the booking drawer's contact fields. */
  user?: BookingUser | null;
}

/**
 * Photo-upload lite mode entry point. Replaces the WebGL2 fallback in
 * `<Showroom>` when the visitor's device fails the WebGL2 capability
 * check.
 *
 * Mirrors `<Showroom>`'s state shape (selectedId + equipped + URL sync)
 * so the URL contract `?anchor=…&eq=…` is identical and visitors can
 * deep-link into a look from either path.
 *
 * Filters the jewelry list to pieces with a `spriteUrl` so the try-on
 * sidebar only shows what we can actually render in 2D. Task 7 will
 * add a banner + "Все украшения" toggle that exposes the full catalog
 * grid for browsing without try-on.
 *
 * See docs/15-lite-mode.md.
 */
export function LiteMode({
  anchors,
  jewelry,
  initialEquipped,
  initialSelectedId,
  pathname = "/catalog",
  user = null,
}: LiteModeProps) {
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const photoUrl = useMemo(
    () => (photoFile ? URL.createObjectURL(photoFile) : null),
    [photoFile],
  );
  useEffect(() => {
    if (!photoUrl) return;
    return () => URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId,
  );
  const [equipped, setEquipped] = useState<EquippedMap>(initialEquipped);
  const [dragOffsets, setDragOffsets] = useState<DragOffsetMap>({});

  const handleUpdateOffset = useCallback(
    (key: string, offset: PixelPoint) => {
      setDragOffsets((prev) => ({ ...prev, [key]: offset }));
    },
    [],
  );

  const handleResetOffsets = useCallback(() => {
    setDragOffsets({});
  }, []);

  const [view, setView] = useState<"tryon" | "grid">("tryon");
  const handleToggleView = useCallback(() => {
    setView((v) => (v === "tryon" ? "grid" : "tryon"));
  }, []);

  const anchorIdToSlug = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of anchors) m.set(a.id, a.slug);
    return m;
  }, [anchors]);

  // Convert `equipped` (anchorId → jewelryId) into the slug-keyed shape
  // SelfieCanvas needs. Skip pairs whose anchor isn't in v1 lite mode —
  // SelfieCanvas already does its own filter via the placements map but
  // we keep the canvas dependency-light by pre-filtering here.
  const equippedBySlug = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [anchorId, jewelryId] of Object.entries(equipped)) {
      const slug = anchorIdToSlug.get(anchorId);
      if (slug) out[slug] = jewelryId;
    }
    return out;
  }, [equipped, anchorIdToSlug]);

  // Pieces eligible for try-on in lite mode.
  const liteJewelry = useMemo(
    () => jewelry.filter((j) => j.spriteUrl != null),
    [jewelry],
  );

  // ── URL sync (same contract as Showroom) ────────────────────────
  const syncUrl = useCallback(
    (next: { anchorId?: string | null; equipped?: EquippedMap }) => {
      const params = new URLSearchParams(searchParams.toString());
      const slugForAnchor =
        next.anchorId === undefined
          ? selectedId
            ? anchorIdToSlug.get(selectedId)
            : null
          : next.anchorId === null
            ? null
            : anchorIdToSlug.get(next.anchorId);
      if (slugForAnchor) params.set("anchor", slugForAnchor);
      else params.delete("anchor");

      const eqMap = next.equipped ?? equipped;
      const eqStr = serializeEquipped(eqMap, anchorIdToSlug);
      if (eqStr) params.set("eq", eqStr);
      else params.delete("eq");

      const qs = params.toString();
      startTransition(() => {
        replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [anchorIdToSlug, equipped, pathname, replace, searchParams, selectedId],
  );

  const handleSelectAnchor = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      syncUrl({ anchorId: id });
    },
    [syncUrl],
  );

  const handleEquip = useCallback(
    (anchorId: string, jewelryId: string) => {
      setEquipped((prev) => {
        if (
          Object.keys(prev).length >= SOFT_CAP &&
          !(anchorId in prev)
        ) {
          return prev;
        }
        const next = { ...prev, [anchorId]: jewelryId };
        syncUrl({ equipped: next });
        return next;
      });
    },
    [syncUrl],
  );

  const handleUnequip = useCallback(
    (anchorId: string) => {
      setEquipped((prev) => {
        if (!(anchorId in prev)) return prev;
        const next = { ...prev };
        delete next[anchorId];
        syncUrl({ equipped: next });
        return next;
      });
    },
    [syncUrl],
  );

  const handleFile = useCallback((file: File) => {
    setPhotoFile(file);
    // New photo → re-run face detection from scratch, drop any drag nudges.
    setDragOffsets({});
  }, []);

  const [bookingOpen, setBookingOpen] = useState(false);

  // Distinct jewelry pieces in the tray, shaped for the booking drawer.
  const bookingItems = useMemo<WizardJewelry[]>(() => {
    const seen = new Set<string>();
    const out: WizardJewelry[] = [];
    for (const jewelryId of Object.values(equipped)) {
      if (seen.has(jewelryId)) continue;
      seen.add(jewelryId);
      const j = jewelry.find((x) => x.id === jewelryId);
      if (j) {
        out.push({
          id: j.id,
          name: j.name,
          price: j.price,
          photo: j.photo,
          inStock: j.inStock,
        });
      }
    }
    return out;
  }, [equipped, jewelry]);

  // ── Layout ──────────────────────────────────────────────────────
  // Mirrors Showroom: stacked on mobile, 1fr/360px grid on lg+.
  const hasOffsets = Object.keys(dragOffsets).length > 0;
  const liteCopy = catalogStrings.liteMode;

  return (
    <>
    <div className="flex h-full flex-col">
      <LiteBanner
        eligibleCount={liteJewelry.length}
        totalCount={jewelry.length}
        view={view}
        onToggle={handleToggleView}
      />
      <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[1fr_360px]">
        <div className="relative h-[60vh] bg-page p-4 lg:h-auto lg:p-6">
          {photoUrl ? (
            <div className="relative h-full w-full">
              <SelfieCanvas
                photoUrl={photoUrl}
                equippedBySlug={equippedBySlug}
                jewelry={jewelry}
                dragOffsets={dragOffsets}
                onUpdateOffset={handleUpdateOffset}
              />
              {hasOffsets ? (
                <button
                  type="button"
                  onClick={handleResetOffsets}
                  className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-line bg-page/85 px-3 py-1.5 text-xs text-ink shadow-sm backdrop-blur transition-colors hover:border-primary hover:text-primary"
                >
                  ↺ <span>{liteCopy.resetOffsets}</span>
                </button>
              ) : null}
              <label className="absolute right-3 top-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-page/85 px-3 py-1.5 text-xs text-ink shadow-sm backdrop-blur transition-colors hover:border-primary hover:text-primary">
                ↻ <span>{liteCopy.swapPhoto}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          ) : (
            <div className="flex h-full flex-col gap-3">
              <div className="flex-1">
                <SelfieDropzone onFile={handleFile} />
              </div>
              <p className="text-center text-xs text-mute">
                {liteCopy.privacy}
              </p>
            </div>
          )}
        </div>

        {view === "tryon" ? (
          <LiteInventoryPanel
            anchors={anchors}
            jewelry={liteJewelry}
            selectedAnchorId={selectedId}
            equipped={equipped}
            canBook={bookingItems.length > 0}
            onBook={() => setBookingOpen(true)}
            onSelectAnchor={handleSelectAnchor}
            onEquip={handleEquip}
            onUnequip={handleUnequip}
          />
        ) : (
          <div className="overflow-y-auto border-line bg-card lg:border-l">
            <CatalogGridFallback
              jewelry={jewelry}
              reason="explicit"
              showroomHref={pathname}
            />
          </div>
        )}
      </div>
    </div>

      <JewelryBookingDrawer
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        items={bookingItems}
        user={user}
      />
    </>
  );
}
