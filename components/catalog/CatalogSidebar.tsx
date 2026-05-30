"use client";

import { CatalogControls } from "./CatalogControls";
import type {
  AnchorWire,
  EquippedMap,
  JewelryWire,
} from "@/lib/catalog/types";

interface CatalogSidebarProps {
  anchors: AnchorWire[];
  jewelry: JewelryWire[];
  selectedAnchorId: string | null;
  equipped: EquippedMap;
  bookHref?: string | null;
  canBook?: boolean;
  onBook?: () => void;
  onSelectAnchor: (id: string | null) => void;
  onEquip: (anchorId: string, jewelryId: string) => void;
  onUnequip: (anchorId: string) => void;
}

/**
 * Docked sidebar shell — the refined right-rail panel used by lite mode and
 * the showroom's mobile/stacked layout. Wraps `CatalogControls` in a scrollable
 * `<aside>` with the Steel Atelier card surface.
 */
export function CatalogSidebar(props: CatalogSidebarProps) {
  return (
    <aside className="flex h-full flex-col overflow-y-auto border-line bg-card p-5 lg:border-l">
      <CatalogControls {...props} />
    </aside>
  );
}
