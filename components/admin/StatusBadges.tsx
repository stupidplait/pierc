import { ru } from "@/lib/i18n/ru";

// Status colour palette (theme-token aware). Keep in sync with the
// JewelryBookingStatus + AppointmentStatus enums in prisma/schema.prisma.

const BOOKING: Record<
  "RESERVED" | "CONFIRMED" | "FULFILLED" | "CANCELLED",
  string
> = {
  RESERVED: "border-line bg-card text-ink",
  CONFIRMED: "border-primary/40 bg-primary/10 text-primary",
  FULFILLED: "border-success/40 bg-success-soft text-success",
  CANCELLED: "border-mute/40 bg-card text-mute",
};

const APPT: Record<
  "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW",
  string
> = {
  PENDING: "border-line bg-card text-ink",
  CONFIRMED: "border-primary/40 bg-primary/10 text-primary",
  COMPLETED: "border-success/40 bg-success-soft text-success",
  CANCELLED: "border-mute/40 bg-card text-mute",
  NO_SHOW: "border-warn/40 bg-warn-soft text-warn",
};

export function BookingStatusBadge({
  status,
}: {
  status: keyof typeof BOOKING;
}) {
  return (
    <span
      className={`inline-flex w-fit rounded-full border px-2.5 py-0.5 text-xs font-medium ${BOOKING[status]}`}
    >
      {ru.admin.statusLabels.booking[status]}
    </span>
  );
}

export function AppointmentStatusBadge({
  status,
}: {
  status: keyof typeof APPT;
}) {
  return (
    <span
      className={`inline-flex w-fit rounded-full border px-2.5 py-0.5 text-xs font-medium ${APPT[status]}`}
    >
      {ru.admin.statusLabels.appointment[status]}
    </span>
  );
}
