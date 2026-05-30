"use client";

import { useState } from "react";
import { AppointmentBookingDrawer } from "./AppointmentBookingDrawer";
import { getBookingExtras } from "@/lib/booking/slot-actions";
import type {
  BookingUser,
  WizardJewelry,
  WizardService,
  WizardSlot,
} from "@/lib/booking/wizard-types";

interface Extras {
  slots: WizardSlot[];
  jewelry: WizardJewelry[];
}

interface ServiceBookButtonProps {
  service: WizardService;
  user: BookingUser | null;
  label: string;
}

// Per-service "Записаться" trigger. Opens the appointment drawer pre-set to this
// service and lazy-loads slots + jewelry on first open (kept in the click
// handler so no setState runs inside an effect).
export function ServiceBookButton({
  service,
  user,
  label,
}: ServiceBookButtonProps) {
  const [open, setOpen] = useState(false);
  const [extras, setExtras] = useState<Extras | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    setOpen(true);
    if (!extras && !loading) {
      setLoading(true);
      try {
        setExtras(await getBookingExtras());
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <>
      {/* Ink-filled pill (the site's primary CTA fill, matching the account
          PILL + booking-wizard footer) — magenta stays reserved for the page
          accents, not the button itself. */}
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex h-10 items-center justify-center rounded-xl bg-ink px-5 text-sm font-medium text-bg transition-colors hover:bg-ink/90 active:scale-[0.99] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {label}
      </button>
      <AppointmentBookingDrawer
        open={open}
        onClose={() => setOpen(false)}
        service={service}
        user={user}
        extras={extras}
        loading={loading}
      />
    </>
  );
}
