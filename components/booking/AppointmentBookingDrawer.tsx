"use client";

import { Drawer } from "./Drawer";
import { BookingForm } from "./BookingForm";
import type {
  BookingUser,
  WizardJewelry,
  WizardService,
  WizardSlot,
} from "@/lib/booking/wizard-types";
import { ru } from "@/lib/i18n/ru";
import { formatPrice } from "@/lib/jewelry/format";

interface Extras {
  slots: WizardSlot[];
  jewelry: WizardJewelry[];
}

interface AppointmentBookingDrawerProps {
  open: boolean;
  onClose: () => void;
  service: WizardService;
  user: BookingUser | null;
  /** Lazily fetched by the trigger; null while loading. */
  extras: Extras | null;
  loading: boolean;
}

// The /book form mounted inside the Drawer (compact layout), with the service
// fixed to the one the user clicked. Same flow, same createBooking action — just
// a different shell, opened in-context from the services page.
export function AppointmentBookingDrawer({
  open,
  onClose,
  service,
  user,
  extras,
  loading,
}: AppointmentBookingDrawerProps) {
  const subtitle = `${formatPrice(service.price)} · ${ru.pages.book.serviceStep.durationMin.replace("{n}", String(service.durationMin))}`;

  return (
    <Drawer open={open} onClose={onClose} title={service.name} subtitle={subtitle}>
      {loading || !extras ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <div className="h-4 w-32 animate-pulse rounded bg-card" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded-xl bg-card" />
          ))}
        </div>
      ) : (
        <BookingForm
          compact
          services={[service]}
          initialServiceId={service.id}
          jewelry={extras.jewelry}
          slots={extras.slots}
          user={user}
          initialItemIds={[]}
        />
      )}
    </Drawer>
  );
}
