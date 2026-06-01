"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { LiteMode } from "@/components/lite/LiteMode";
import { JewelryBookingDrawer } from "@/components/booking/JewelryBookingDrawer";
import {
  type AnchorWire,
  type EquippedMap,
  type JewelryWire,
  SOFT_CAP,
} from "@/lib/catalog/types";
import type { BookingUser, WizardJewelry } from "@/lib/booking/wizard-types";
import { serializeEquipped } from "@/lib/catalog/url-state";
import { useWebGL2Supported } from "@/lib/catalog/use-webgl2";
import type { CatalogViewProps } from "./views/parts";
import { CatalogConsoleView } from "./views/CatalogConsoleView";

interface ShowroomProps {
  anchors: AnchorWire[];
  jewelry: JewelryWire[];
  initialSelectedId: string | null;
  initialEquipped: EquippedMap;
  /**
   * Where to write URL state when the user interacts. The Showroom is rendered
   * on `/catalog`; each owns its own search-param contract on its own pathname.
   */
  pathname?: string;
  /** Hide the "Простой каталог" link in the corner (unused by /catalog today). */
  hideGridLink?: boolean;
  /** Signed-in user, used to prefill the booking drawer's contact fields. */
  user?: BookingUser | null;
}

export function Showroom({
  anchors,
  jewelry,
  initialSelectedId,
  initialEquipped,
  pathname = "/catalog",
  hideGridLink = false,
  user = null,
}: ShowroomProps) {
  const { replace } = useRouter();
  const [, startTransition] = useTransition();

  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId,
  );
  const [equipped, setEquipped] = useState<EquippedMap>(initialEquipped);
  const [bookingOpen, setBookingOpen] = useState(false);
  const webgl2Supported = useWebGL2Supported();

  // Distinct jewelry pieces in the tray (a multi-anchor piece counts once),
  // shaped for the booking drawer.
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

  const anchorIdToSlug = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of anchors) m.set(a.id, a.slug);
    return m;
  }, [anchors]);

  // Track previous query string to avoid unnecessary URL updates
  const prevQueryRef = useRef<string>("");

  // Sync URL after state changes — runs after render, not during.
  useEffect(() => {
    const params = new URLSearchParams();

    const slugForAnchor = selectedId ? anchorIdToSlug.get(selectedId) : null;
    if (slugForAnchor) params.set("anchor", slugForAnchor);

    const eqStr = serializeEquipped(equipped, anchorIdToSlug);
    if (eqStr) params.set("eq", eqStr);

    const qs = params.toString();

    if (qs !== prevQueryRef.current) {
      prevQueryRef.current = qs;
      startTransition(() => {
        replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    }
  }, [selectedId, equipped, anchorIdToSlug, pathname, replace]);

  const handleSelectAnchor = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const handleEquip = useCallback((anchorId: string, jewelryId: string) => {
    setEquipped((prev) => {
      if (Object.keys(prev).length >= SOFT_CAP && !(anchorId in prev)) {
        return prev;
      }
      return { ...prev, [anchorId]: jewelryId };
    });
  }, []);

  const handleUnequip = useCallback((anchorId: string) => {
    setEquipped((prev) => {
      if (!(anchorId in prev)) return prev;
      const next = { ...prev };
      delete next[anchorId];
      return next;
    });
  }, []);

  // WebGL2 capability check — render lite mode (selfie + sprite overlay) when 3D
  // isn't available. `?view=grid` opt-in is handled at the page level.
  if (webgl2Supported === false) {
    return (
      <LiteMode
        anchors={anchors}
        jewelry={jewelry}
        initialEquipped={initialEquipped}
        initialSelectedId={initialSelectedId}
        pathname={pathname}
        user={user}
      />
    );
  }

  const viewProps: CatalogViewProps = {
    anchors,
    jewelry,
    selectedAnchorId: selectedId,
    equipped,
    canBook: bookingItems.length > 0,
    onBook: () => setBookingOpen(true),
    onSelectAnchor: handleSelectAnchor,
    onEquip: handleEquip,
    onUnequip: handleUnequip,
    hideGridLink,
    cardVariant: "frame",
  };

  return (
    <>
      <CatalogConsoleView {...viewProps} />

      <JewelryBookingDrawer
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        items={bookingItems}
        user={user}
      />
    </>
  );
}
