"use client";

import { useState } from "react";
import { JewelryBookingDrawer } from "./JewelryBookingDrawer";
import type { BookingUser, WizardJewelry } from "@/lib/booking/wizard-types";

interface JewelryDetailBookButtonProps {
  item: WizardJewelry;
  user: BookingUser | null;
  label: string;
}

// Opens the in-context booking drawer for a single piece from the product
// detail page — same drawer the showroom tray uses, so there's no jarring
// navigation to a separate /book page.
export function JewelryDetailBookButton({
  item,
  user,
  label,
}: JewelryDetailBookButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-12 items-center rounded-full border border-primary px-6 font-medium text-primary transition-colors hover:bg-primary hover:text-on-primary active:scale-[0.99]"
      >
        {label}
      </button>
      <JewelryBookingDrawer
        open={open}
        onClose={() => setOpen(false)}
        items={[item]}
        user={user}
      />
    </>
  );
}
