"use client";

import { CatalogControls } from "./CatalogControls";
import type {
  AnchorWire,
  EquippedMap,
  JewelryWire,
} from "@/lib/catalog/types";

interface CatalogFloatingHUDProps {
  anchors: AnchorWire[];
  jewelry: JewelryWire[];
  selectedAnchorId: string | null;
  equipped: EquippedMap;
  canBook?: boolean;
  onBook?: () => void;
  onSelectAnchor: (id: string | null) => void;
  onEquip: (anchorId: string, jewelryId: string) => void;
  onUnequip: (anchorId: string) => void;
}

/**
 * Floating glass HUD — the bold desktop layout for the showroom. A translucent
 * panel (`bg-bg-elev/70 backdrop-blur-xl`) absolutely positioned over the
 * full-bleed 3D scene. Hidden on mobile (showroom falls back to the docked
 * stacked layout).
 */
export function CatalogFloatingHUD(props: CatalogFloatingHUDProps) {
  return (
    <div className="pointer-events-none absolute inset-0 hidden lg:block">
      <div className="pointer-events-auto absolute right-6 top-6 flex h-[calc(100vh-8rem)] w-[360px] flex-col overflow-hidden rounded-2xl border border-line bg-bg-elev/70 p-5 shadow-elev backdrop-blur-xl">
        <CatalogControls {...props} />
      </div>
    </div>
  );
}
