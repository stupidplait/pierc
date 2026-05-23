"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { CatalogSidebar } from "./CatalogSidebar";
import { CatalogGridFallback } from "./CatalogGridFallback";
import {
  type AnchorWire,
  type EquippedMap,
  type JewelryWire,
  SOFT_CAP,
} from "@/lib/catalog/types";
import { catalogStrings } from "@/lib/i18n/ru";
import { serializeEquipped } from "@/lib/catalog/url-state";
import { useWebGL2Supported } from "@/lib/catalog/use-webgl2";

// Three.js needs window — defer the entire scene until after hydration.
const ShowroomScene = dynamic(
  () => import("./ShowroomScene").then((m) => m.ShowroomScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-sm text-mute">
        {catalogStrings.showroom.sceneLoading}
      </div>
    ),
  },
);

interface ShowroomProps {
  anchors: AnchorWire[];
  jewelry: JewelryWire[];
  initialSelectedId: string | null;
  initialEquipped: EquippedMap;
  /**
   * Where to write URL state when the user interacts. The Showroom is rendered
   * on `/catalog` (default) and embedded on `/` (landing); each owns its own
   * search-param contract on its own pathname.
   */
  pathname?: string;
  /**
   * When true, hide the "Простой каталог" link in the corner. The landing
   * embed doesn't need it because the user is on the storytelling flow.
   */
  hideGridLink?: boolean;
}

export function Showroom({
  anchors,
  jewelry,
  initialSelectedId,
  initialEquipped,
  pathname = "/catalog",
  hideGridLink = false,
}: ShowroomProps) {
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId,
  );
  const [equipped, setEquipped] = useState<EquippedMap>(initialEquipped);
  const webgl2Supported = useWebGL2Supported();

  const anchorIdToSlug = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of anchors) m.set(a.id, a.slug);
    return m;
  }, [anchors]);

  // Keep the URL in sync — don't trigger a server roundtrip.
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

  // Layout is height-agnostic: parent decides the actual height. On /catalog
  // the page wraps with `lg:h-[calc(100vh-4.5rem)]`; on / the chapter wraps
  // with a fixed `90vh`-ish container.

  // ── WebGL2 capability check — render the 2D grid when 3D isn't available.
  // useWebGL2Supported returns null briefly during the initial paint; we
  // render the loading shell during that window (handled inside the Canvas
  // dynamic-import below). Once it resolves false, swap to the fallback.
  if (webgl2Supported === false) {
    return (
      <CatalogGridFallback
        jewelry={jewelry}
        reason="fallback"
        showroomHref="/catalog"
      />
    );
  }

  return (
    <div className="flex h-full flex-col lg:grid lg:grid-cols-[1fr_360px]">
      <div className="relative h-[60vh] bg-page lg:h-auto">
        <ShowroomScene
          anchors={anchors}
          jewelry={jewelry}
          selectedId={selectedId}
          equipped={equipped}
          onSelectAnchor={handleSelectAnchor}
        />
        {!hideGridLink ? (
          <Link
            href="/catalog?view=grid"
            className="absolute right-3 top-3 rounded-full border border-line bg-page/80 px-3 py-1 text-xs text-mute backdrop-blur transition-colors hover:border-primary hover:text-primary"
          >
            {catalogStrings.showroom.gridLink}
          </Link>
        ) : null}
      </div>

      <CatalogSidebar
        anchors={anchors}
        jewelry={jewelry}
        selectedAnchorId={selectedId}
        equipped={equipped}
        bookHref={(() => {
          const ids = Object.values(equipped);
          if (ids.length === 0) return null;
          return `/book?items=${encodeURIComponent(ids.join(","))}`;
        })()}
        onSelectAnchor={handleSelectAnchor}
        onEquip={handleEquip}
        onUnequip={handleUnequip}
      />
    </div>
  );
}
