"use client";

import Image from "next/image";
import { useMemo } from "react";
import { X } from "lucide-react";
import {
  type AnchorWire,
  type BodyPlace,
  type EquippedMap,
  type JewelryWire,
  SOFT_CAP,
} from "@/lib/catalog/types";
import {
  bodyPlaceLabels,
  bodyPlaceOrder,
  catalogStrings,
  piercingCountLabel,
} from "@/lib/i18n/ru";
import { formatPrice } from "@/lib/jewelry/format";
import { Button } from "@/components/shadcn/ui/button";
import { Badge } from "@/components/shadcn/ui/badge";
import {
  Card,
  CardContent,
  CardEyebrow,
  CardHeader,
} from "@/components/shadcn/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/ui/select";
import { Separator } from "@/components/shadcn/ui/separator";
import { cn } from "@/lib/utils";

interface CatalogControlsProps {
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

export function CatalogControls({
  anchors,
  jewelry,
  selectedAnchorId,
  equipped,
  bookHref,
  canBook,
  onBook,
  onSelectAnchor,
  onEquip,
  onUnequip,
}: CatalogControlsProps) {
  const t = catalogStrings.showroom;

  // Create stable keys to avoid recalculating when array references change
  const anchorsKey = useMemo(() => anchors.map(a => a.id).join(','), [anchors]);
  const jewelryKey = useMemo(() => jewelry.map(j => j.id).join(','), [jewelry]);

  const grouped = useMemo(() => {
    const out = {} as Record<BodyPlace, AnchorWire[]>;
    for (const place of bodyPlaceOrder) out[place] = [];
    for (const a of anchors) out[a.place].push(a);
    return out;
  }, [anchors, anchorsKey]);

  const filtered = useMemo(() => {
    if (!selectedAnchorId) return jewelry;
    return jewelry.filter((j) => j.anchorIds.includes(selectedAnchorId));
  }, [jewelry, jewelryKey, selectedAnchorId]);

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
  }, [equipped, anchors, jewelry, anchorsKey, jewelryKey]);

  const trayCount = equippedItems.length;
  const limitReached = trayCount >= SOFT_CAP;
  const equippedAtActive = selectedAnchorId ? equipped[selectedAnchorId] : undefined;

  const selectValue = selectedAnchorId ?? "__all__";
  const handleSelectChange = (v: string) => {
    onSelectAnchor(v === "__all__" ? null : v);
  };

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Anchor picker */}
      <div className="flex flex-col gap-2">
        <CardEyebrow>{t.anchorPickerLabel}</CardEyebrow>
        <Select value={selectValue} onValueChange={handleSelectChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t.anchorAll}</SelectItem>
            {bodyPlaceOrder.map((place) =>
              grouped[place].length > 0 ? (
                <SelectGroup key={place}>
                  <SelectLabel>{bodyPlaceLabels[place]}</SelectLabel>
                  {grouped[place].map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null,
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Tray */}
      <Card>
        <CardHeader className="flex-row items-baseline justify-between gap-2 pb-3">
          <CardEyebrow>{t.trayHeading}</CardEyebrow>
          <Badge
            variant={limitReached ? "accent" : "secondary"}
            className="text-[10px]"
          >
            {trayCount}/{SOFT_CAP}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          {trayCount === 0 ? (
            <p className="text-xs text-mute">
              {t.traySoftCap.replace("{n}", String(SOFT_CAP))}
            </p>
          ) : (
            <>
              {equippedItems.map(({ anchor, item }) => (
                <div
                  key={anchor.id}
                  className="flex items-center gap-3 rounded-lg border border-line bg-page p-2"
                >
                  <Thumb url={item.photo} alt={item.name} small />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {item.name}
                    </p>
                    <p className="truncate text-xs text-mute">{anchor.name}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onUnequip(anchor.id)}
                    className="size-8 shrink-0"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </>
          )}
          {limitReached ? (
            <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
              {t.trayLimitReached.replace("{n}", String(SOFT_CAP))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Separator />

      {/* Filtered list */}
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <CardEyebrow>
            {selectedAnchorId
              ? anchors.find((a) => a.id === selectedAnchorId)?.name
              : t.anchorAll}
          </CardEyebrow>
          <span className="text-xs text-mute">
            {filtered.length} {t.pieces}
          </span>
        </div>

        {!selectedAnchorId && filtered.length > 0 ? (
          <p className="text-xs text-mute">{t.listAnchorPrompt}</p>
        ) : null}

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-mute">
              {selectedAnchorId ? t.listEmpty : catalogStrings.empty}
            </p>
          ) : (
            filtered.map((j) => {
              const isEquippedHere = equippedAtActive === j.id;
              const canEquip = selectedAnchorId !== null;
              const blockedByCap =
                !isEquippedHere && limitReached && !equippedAtActive;
              return (
                <div
                  key={j.id}
                  className="flex items-center gap-3 rounded-lg border border-line bg-page p-2 transition-colors hover:border-ink/35"
                >
                  <Thumb url={j.photo} alt={j.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {j.name}
                    </p>
                    <p className="truncate text-xs text-mute">
                      {j.categoryName} · {formatPrice(j.price)}
                    </p>
                    {j.piercingCount > 1 ? (
                      <Badge
                        variant="accent"
                        className="mt-1 text-[10px]"
                        title={t.multiAnchorHint}
                      >
                        {piercingCountLabel(j.piercingCount)}
                      </Badge>
                    ) : null}
                  </div>
                  {isEquippedHere ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        selectedAnchorId && onUnequip(selectedAnchorId)
                      }
                      className="shrink-0 bg-accent text-on-primary hover:bg-accent/90"
                    >
                      {t.unequip}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canEquip || blockedByCap}
                      onClick={() =>
                        selectedAnchorId && onEquip(selectedAnchorId, j.id)
                      }
                      className="shrink-0"
                    >
                      {t.equip}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Book CTA */}
      {onBook ? (
        canBook ? (
          <Button
            onClick={onBook}
            className="w-full bg-primary text-on-primary hover:bg-primary-soft"
          >
            {catalogStrings.bookCta}
          </Button>
        ) : null
      ) : bookHref ? (
        <Button
          asChild
          className="w-full bg-primary text-on-primary hover:bg-primary-soft"
        >
          <a href={bookHref}>{catalogStrings.bookCta}</a>
        </Button>
      ) : null}
    </div>
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
      className={cn(
        "relative shrink-0 overflow-hidden rounded-lg bg-card",
      )}
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
