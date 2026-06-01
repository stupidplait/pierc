import Link from "next/link";
import { ru } from "@/lib/i18n/ru";
import { formatRuPhone, ruPhoneHref } from "@/lib/phone";
import { BookingStatusBadge } from "@/components/admin/StatusBadges";
import { BookingStatusStepper } from "@/components/admin/bookings/BookingStatusStepper";
import { BookingTransitionForm } from "@/components/admin/BookingTransitionForm";
import {
  ConsoleShell,
  type ConsoleRailGroup,
} from "@/components/admin/console/ConsoleShell";
import { Card, CardEyebrow } from "@/components/shadcn/ui/card";
import { Separator } from "@/components/shadcn/ui/separator";
import type { BookingDayGroup, BookingStatus } from "@/lib/admin/bookings-view";
import { BOOKING_TONE } from "../status";

/** Plain, fully-formatted dossier the page hands the console for the open row. */
export interface ConsoleBookingDetail {
  id: string;
  status: BookingStatus;
  createdAtLabel: string;
  jewelryId: string;
  jewelryName: string;
  jewelryMaterial: string;
  jewelryPrice: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  appointment: { id: string; slotLabel: string | null } | null;
  notes: string | null;
}

/**
 * Bookings console — the master–detail twin of the appointments console. Left
 * rail = day groups (tone dot + piece + client + price); right pane = the open
 * booking's dossier (jewelry subject, client, linked appointment, status stepper
 * + transition actions). Built on the shared ConsoleShell so the two pages read
 * as one family. Selecting a row updates ?sel without leaving the page.
 */
export function BookingsConsole({
  groups,
  selected,
  selectedId,
  buildSelHref,
}: {
  groups: BookingDayGroup[];
  selected: ConsoleBookingDetail | null;
  selectedId: string | null;
  buildSelHref: (id: string) => string;
}) {
  const railGroups: ConsoleRailGroup[] = groups.map((g) => ({
    key: g.key,
    label: g.label,
    items: g.items.map((b) => ({
      id: b.id,
      dotClass: BOOKING_TONE[b.status].dot,
      title: b.jewelryName,
      subtitle: b.clientName,
      meta: b.price,
    })),
  }));

  return (
    <ConsoleShell
      groups={railGroups}
      selectedId={selectedId}
      buildSelHref={buildSelHref}
      emptyPrompt={ru.admin.bookings.selectPrompt}
    >
      {selected ? <Dossier selected={selected} /> : undefined}
    </ConsoleShell>
  );
}

function Dossier({ selected }: { selected: ConsoleBookingDetail }) {
  const t = ru.admin.bookings;
  return (
    <Card className="h-fit p-6 sm:p-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <BookingStatusBadge status={selected.status} />
        <span className="text-xs text-mute tabular-nums">
          {selected.createdAtLabel}
        </span>
        <Link
          href={`/admin/bookings/${selected.id}`}
          className="ml-auto text-xs text-mute underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          {t.detail.title} ↗
        </Link>
      </div>

      <Link
        href={`/admin/jewelry/${selected.jewelryId}/edit`}
        className="font-display text-2xl font-medium tracking-tight text-ink transition-colors hover:text-accent"
      >
        {selected.jewelryName}
      </Link>
      <p className="mt-1.5 text-sm text-mute">
        {selected.jewelryMaterial} · {selected.jewelryPrice}
      </p>

      <Separator className="my-6" />

      <div className="grid gap-6 sm:grid-cols-2">
        <section>
          <CardEyebrow className="mb-2">{t.detail.clientHeading}</CardEyebrow>
          <p className="text-sm text-ink">{selected.clientName}</p>
          <p className="mt-1 text-sm text-mute">
            <a
              href={`mailto:${selected.clientEmail}`}
              className="transition-colors hover:text-ink"
            >
              {selected.clientEmail}
            </a>
            {selected.clientPhone ? (
              <>
                {" · "}
                <a
                  href={`tel:${ruPhoneHref(selected.clientPhone)}`}
                  className="transition-colors hover:text-ink"
                >
                  {formatRuPhone(selected.clientPhone)}
                </a>
              </>
            ) : null}
          </p>
        </section>

        {selected.appointment ? (
          <section>
            <CardEyebrow className="mb-2">
              {t.detail.appointmentHeading}
            </CardEyebrow>
            <Link
              href={`/admin/appointments/${selected.appointment.id}`}
              className="text-sm text-ink transition-colors hover:text-accent"
            >
              {selected.appointment.slotLabel ?? ru.admin.appointments.noSlot}
            </Link>
          </section>
        ) : null}
      </div>

      <Separator className="my-6" />

      <BookingStatusStepper status={selected.status} />
      <Separator className="my-6" />
      <BookingTransitionForm
        bookingId={selected.id}
        status={selected.status}
        initialNotes={selected.notes}
      />
    </Card>
  );
}
