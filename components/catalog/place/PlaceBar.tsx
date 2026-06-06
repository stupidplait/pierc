"use client";

import { useState } from "react";
import { ChevronUp, Crosshair } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/shadcn/ui/popover";
import { catalogStrings } from "@/lib/i18n/ru";
import { useLenisScroll } from "@/lib/catalog/use-lenis-scroll";
import { cn } from "@/lib/utils";
import { ZoneList, type PlaceSelectorProps } from "./ZoneList";

/**
 * PlaceBar — a slim floating zone pill, bottom-center. Shows the active zone
 * (or "Все зоны") and opens a grouped zone popover. Primary place selection is
 * still clicking the body dots; this is the discoverable quick-jump that lives
 * outside the inventory panel.
 */
export function PlaceBar({
  anchors,
  selectedAnchorId,
  onSelectAnchor,
}: PlaceSelectorProps) {
  const [open, setOpen] = useState(false);
  const wheelRef = useLenisScroll();
  const selected = anchors.find((a) => a.id === selectedAnchorId) ?? null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-4">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="pointer-events-auto flex w-72 items-center gap-2 rounded-xl border border-line bg-bg-elev/85 px-4 py-2.5 text-sm text-ink shadow-lg backdrop-blur-xl transition-colors hover:border-accent"
          >
            <Crosshair className="size-4 shrink-0 text-accent" />
            <span className="min-w-0 flex-1 truncate text-left">
              {selected ? selected.name : catalogStrings.showroom.allZones}
            </span>
            <ChevronUp
              className={cn(
                "size-4 shrink-0 text-mute transition-transform",
                open && "rotate-180",
              )}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          ref={wheelRef}
          align="center"
          side="top"
          data-lenis-prevent
          className="no-scrollbar max-h-[60vh] w-72 overflow-y-auto p-3"
        >
          <ZoneList
            anchors={anchors}
            selectedAnchorId={selectedAnchorId}
            onSelectAnchor={onSelectAnchor}
            onPicked={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
