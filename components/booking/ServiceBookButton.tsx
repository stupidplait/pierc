"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { getBookingExtras } from "@/lib/booking/slot-actions";
import type {
  BookingUser,
  WizardJewelry,
  WizardService,
  WizardSlot,
} from "@/lib/booking/wizard-types";

// Lazy-load the booking wizard (Drawer + BookingForm + step components, ~1.5k
// lines of interactive client code) on first open instead of shipping it into
// the /services bundle for every card up front. ssr:false — it's purely
// interactive and hidden until the user clicks "Записаться".
const AppointmentBookingDrawer = dynamic(
  () =>
    import("./AppointmentBookingDrawer").then((m) => m.AppointmentBookingDrawer),
  { ssr: false },
);

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
  const [mounted, setMounted] = useState(false);
  const [extras, setExtras] = useState<Extras | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    // First click mounts the lazy drawer chunk; it stays mounted afterwards so
    // the close animation can play.
    setMounted(true);
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
      {mounted ? (
        <AppointmentBookingDrawer
          open={open}
          onClose={() => setOpen(false)}
          service={service}
          user={user}
          extras={extras}
          loading={loading}
        />
      ) : null}
    </>
  );
}
