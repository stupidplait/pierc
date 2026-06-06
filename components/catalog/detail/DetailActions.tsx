"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { JewelryWire } from "@/lib/catalog/types";
import type { DetailVariant } from "@/lib/catalog/lab-state";
import type { BookingUser } from "@/lib/booking/wizard-types";
import { catalogStrings } from "@/lib/i18n/ru";
import { Button } from "@/components/shadcn/ui/button";
import { JewelryBookingDrawer } from "@/components/booking/JewelryBookingDrawer";
import { cn } from "@/lib/utils";
import type { DetailPiece } from "./parts";

const ct = catalogStrings.showroom;

/**
 * DetailActions — the single, consistent CTA row for the piece detail (in-rail
 * card page AND the centered overlay). All three actions share ONE Button
 * component (accent · outline · ghost) at the same size, so they match each
 * other and the rest of the design system (ux-similarity-consistency). Owns the
 * booking drawer so "Забронировать" no longer needs a bespoke button.
 */
export function DetailActions({
  jewelry,
  dp,
  user,
  detail,
  onEquip,
  size = "lg",
  className,
}: {
  jewelry: JewelryWire;
  dp: DetailPiece;
  user: BookingUser | null;
  detail: DetailVariant;
  onEquip: () => void;
  size?: "default" | "lg";
  className?: string;
}) {
  const [bookOpen, setBookOpen] = useState(false);

  return (
    <>
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        <Button variant="accent" size={size} onClick={onEquip}>
          {ct.tryItOn}
        </Button>
        {dp.outOfStock ? (
          <Button variant="outline" size={size} disabled>
            {catalogStrings.outOfStock}
          </Button>
        ) : (
          <Button variant="outline" size={size} onClick={() => setBookOpen(true)}>
            {catalogStrings.bookCta}
          </Button>
        )}
        {detail === "both" ? (
          <Button
            asChild
            variant="ghost"
            size={size === "lg" ? "default" : "sm"}
            className="gap-1.5"
          >
            <Link href={`/catalog/${jewelry.id}`}>
              {ct.viewProduct}
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        ) : null}
      </div>

      <JewelryBookingDrawer
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        items={[
          {
            id: jewelry.id,
            name: jewelry.name,
            price: dp.priceLabel,
            photo: jewelry.photo,
            inStock: jewelry.inStock,
          },
        ]}
        user={user}
      />
    </>
  );
}
