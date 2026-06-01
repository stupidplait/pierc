import Link from "next/link";
import { ru } from "@/lib/i18n/ru";
import { formatRuPhone, ruPhoneHref } from "@/lib/phone";
import { AppointmentStatusBadge, BookingStatusBadge } from "@/components/admin/StatusBadges";
import { AppointmentStatusStepper } from "@/components/admin/appointments/AppointmentStatusStepper";
import { AppointmentTransitionForm } from "@/components/admin/AppointmentTransitionForm";
import {
  ConsoleShell,
  type ConsoleRailGroup,
} from "@/components/admin/console/ConsoleShell";
import { Card, CardEyebrow } from "@/components/shadcn/ui/card";
import { Separator } from "@/components/shadcn/ui/separator";
import { fmtTime, type ApptStatus, type DayGroup } from "@/lib/admin/appointments-view";
import { APPT_TONE } from "../status";

type BookingStatus = "RESERVED" | "CONFIRMED" | "FULFILLED" | "CANCELLED";

export interface ConsoleBooking {
  id: string;
  status: BookingStatus;
  jewelryName: string;
  jewelryPrice: string;
}

/** Plain, fully-formatted dossier the page hands the console for the open row. */
export interface ConsoleAppointment {
  id: string;
  status: ApptStatus;
  createdAtLabel: string;
  userName: string;
  userEmail: string;
  userPhone: string | null;
  service: { name: string; priceLabel: string; durationMin: number } | null;
  slotLabel: string | null;
  bookings: ConsoleBooking[];
  notes: string | null;
}

/**
 * Appointments console — the master–detail triage surface. Builds the left-rail
 * model (day groups → tone dot + name + time) and the right-pane dossier (client,
 * service, slot, linked bookings + the status stepper and transition actions),
 * then hands both to the shared ConsoleShell. Selecting a row updates ?sel
 * without leaving the page.
 */
export function ConsoleView({
  groups,
  selected,
  selectedId,
  buildSelHref,
}: {
  groups: DayGroup[];
  selected: ConsoleAppointment | null;
  selectedId: string | null;
  buildSelHref: (id: string) => string;
}) {
  const t = ru.admin.appointments;

  const railGroups: ConsoleRailGroup[] = groups.map((g) => ({
    key: g.key,
    label: g.label,
    items: g.items.map((a) => ({
      id: a.id,
      dotClass: APPT_TONE[a.status].dot,
      title: a.userName,
      meta: fmtTime(a.startsAt),
    })),
  }));

  return (
    <ConsoleShell
      groups={railGroups}
      selectedId={selectedId}
      buildSelHref={buildSelHref}
      emptyPrompt={t.selectPrompt}
    >
      {selected ? <Dossier selected={selected} /> : undefined}
    </ConsoleShell>
  );
}

function Dossier({ selected }: { selected: ConsoleAppointment }) {
  const t = ru.admin.appointments;
  return (
    <Card className="h-fit p-6 sm:p-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <AppointmentStatusBadge status={selected.status} />
        <span className="text-xs text-mute">{selected.createdAtLabel}</span>
        <Link
          href={`/admin/appointments/${selected.id}`}
          className="ml-auto text-xs text-mute underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          {t.detail.title} ↗
        </Link>
      </div>

      <h2 className="font-display text-2xl font-medium tracking-tight text-ink">
        {selected.userName}
      </h2>
      <p className="mt-1.5 text-sm text-mute">
        <a
          href={`mailto:${selected.userEmail}`}
          className="transition-colors hover:text-ink"
        >
          {selected.userEmail}
        </a>
        {selected.userPhone ? (
          <>
            {" · "}
            <a
              href={`tel:${ruPhoneHref(selected.userPhone)}`}
              className="transition-colors hover:text-ink"
            >
              {formatRuPhone(selected.userPhone)}
            </a>
          </>
        ) : null}
      </p>

      <Separator className="my-6" />

      <div className="grid gap-6 sm:grid-cols-2">
        <section>
          <CardEyebrow className="mb-2">{t.detail.serviceHeading}</CardEyebrow>
          {selected.service ? (
            <p className="text-sm text-ink">
              {selected.service.name}
              <span className="block text-mute">
                {selected.service.priceLabel} · {selected.service.durationMin}{" "}
                {t.durationSuffix}
              </span>
            </p>
          ) : (
            <p className="text-sm text-mute">{t.detail.noService}</p>
          )}
        </section>

        <section>
          <CardEyebrow className="mb-2">{t.detail.slotHeading}</CardEyebrow>
          <p className="text-sm text-ink">{selected.slotLabel ?? t.noSlot}</p>
        </section>
      </div>

      {selected.bookings.length > 0 ? (
        <>
          <Separator className="my-6" />
          <CardEyebrow className="mb-2">{t.linkedBookings}</CardEyebrow>
          <ul className="flex flex-col">
            {selected.bookings.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 py-2.5 first:pt-0 last:border-0 last:pb-0"
              >
                <BookingStatusBadge status={b.status} />
                <Link
                  href={`/admin/bookings/${b.id}`}
                  className="min-w-0 flex-1 truncate text-sm text-ink transition-colors hover:text-mute"
                >
                  {b.jewelryName}
                </Link>
                <span className="text-xs text-mute">{b.jewelryPrice}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <Separator className="my-6" />

      <AppointmentStatusStepper status={selected.status} />
      <Separator className="my-6" />
      <AppointmentTransitionForm
        appointmentId={selected.id}
        status={selected.status}
        initialNotes={selected.notes}
      />
    </Card>
  );
}
