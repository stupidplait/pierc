"use client";

import type { AnchorWire } from "@/lib/catalog/types";
import { catalogStrings } from "@/lib/i18n/ru";
import { Chip, groupAnchorsByPlace } from "../cards/shared";

/** Shared props for every place-selection variant. */
export interface PlaceSelectorProps {
  anchors: AnchorWire[];
  selectedAnchorId: string | null;
  onSelectAnchor: (id: string | null) => void;
}

/**
 * The grouped zone list — "show all" + a chip per anchor under each body-place
 * heading. Reused by the bar popover, the left body-map panel and the rail
 * dropdown so all three place-selection variants share one list UI.
 */
export function ZoneList({
  anchors,
  selectedAnchorId,
  onSelectAnchor,
  onPicked,
}: PlaceSelectorProps & { onPicked?: () => void }) {
  const groups = groupAnchorsByPlace(anchors);
  const pick = (id: string | null) => {
    onSelectAnchor(id);
    onPicked?.();
  };

  return (
    <div className="flex flex-col gap-3">
      <Chip active={!selectedAnchorId} onClick={() => pick(null)}>
        {catalogStrings.showroom.anchorAll}
      </Chip>
      {groups.map((g) => (
        <div key={g.place}>
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
            {g.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {g.anchors.map((a: AnchorWire) => (
              <Chip
                key={a.id}
                active={selectedAnchorId === a.id}
                onClick={() => pick(a.id)}
              >
                {a.name}
              </Chip>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
