import { ru, jewelryStatusLabels } from "@/lib/i18n/ru";
import { Badge } from "@/components/shadcn/ui/badge";

// Status colour palette (theme-token aware). Keep in sync with the
// JewelryBookingStatus + AppointmentStatus enums in prisma/schema.prisma.
//
// Each entry is layered over the shadcn `Badge` (variant="outline") base. The
// shared PILL string restores the rounded-full pill shape over Badge's
// `rounded-md`; `cn`/twMerge inside Badge lets the per-status border/bg/text
// utilities win over the variant defaults.

const PILL = "w-fit rounded-full px-2.5 py-0.5";

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

const REVIEW: Record<"PENDING" | "PUBLISHED" | "REJECTED", string> = {
  PENDING: "border-line bg-card text-ink",
  PUBLISHED: "border-success/40 bg-success-soft text-success",
  REJECTED: "border-mute/40 bg-card text-mute",
};

const JEWELRY: Record<
  "DRAFT" | "PROCESSING" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED",
  string
> = {
  DRAFT: "border-line bg-card text-mute",
  PROCESSING: "border-primary/40 bg-primary/10 text-primary",
  PENDING_REVIEW: "border-warn/40 bg-warn-soft text-warn",
  PUBLISHED: "border-success/40 bg-success-soft text-success",
  REJECTED: "border-mute/40 bg-card text-mute",
};

export function BookingStatusBadge({
  status,
}: {
  status: keyof typeof BOOKING;
}) {
  return (
    <Badge variant="outline" className={`${PILL} ${BOOKING[status]}`}>
      {ru.admin.statusLabels.booking[status]}
    </Badge>
  );
}

export function AppointmentStatusBadge({
  status,
}: {
  status: keyof typeof APPT;
}) {
  return (
    <Badge variant="outline" className={`${PILL} ${APPT[status]}`}>
      {ru.admin.statusLabels.appointment[status]}
    </Badge>
  );
}

export function ReviewStatusBadge({
  status,
}: {
  status: keyof typeof REVIEW;
}) {
  return (
    <Badge variant="outline" className={`${PILL} ${REVIEW[status]}`}>
      {ru.admin.statusLabels.review[status]}
    </Badge>
  );
}

export function JewelryStatusBadge({
  status,
}: {
  status: keyof typeof JEWELRY;
}) {
  return (
    <Badge variant="outline" className={`${PILL} ${JEWELRY[status]}`}>
      {jewelryStatusLabels[status]}
    </Badge>
  );
}
