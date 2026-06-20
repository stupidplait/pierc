import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatRuPhone, ruPhoneHref } from "@/lib/phone";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { Button } from "@/components/ui/Button";
import {
  AppointmentStatusBadge,
  BookingStatusBadge,
} from "@/components/admin/StatusBadges";
import { AppointmentTransitionForm } from "@/components/admin/AppointmentTransitionForm";
import { AppointmentStatusStepper } from "@/components/admin/appointments/AppointmentStatusStepper";
import { Reveal } from "@/components/admin/form/atelier";
import { Card, CardEyebrow } from "@/components/shadcn/ui/card";
import { Separator } from "@/components/shadcn/ui/separator";
import { formatDuration, formatPrice } from "@/lib/jewelry/format";

const RU_DT = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const RU_TIME = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

interface Props {
  params: Promise<{ id: string }>;
}

// Dedup the row read across generateMetadata + the page body within one request.
const getAppointment = cache((id: string) =>
  prisma.appointment.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      slot: true,
      service: { select: { name: true, price: true, durationMin: true } },
      bookings: {
        include: { jewelry: { select: { id: true, name: true, price: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  }),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const a = await getAppointment(id);
  return {
    title: a?.user?.name ?? ru.admin.appointments.detail.title,
  };
}

export default async function AdminAppointmentDetailPage({ params }: Props) {
  const { id } = await params;
  const appt = await getAppointment(id);
  if (!appt) notFound();

  const t = ru.admin.appointments;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-10 flex flex-col gap-4 pt-2 sm:mb-12 sm:flex-row sm:items-end sm:justify-between sm:pt-4">
        <h1 className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          {t.detail.title}
        </h1>
        <Button
          href="/admin/appointments"
          variant="ghost"
          size="sm"
          className="shrink-0"
        >
          ← {t.backToList}
        </Button>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <AppointmentStatusBadge status={appt.status} />
        <span className="text-xs text-mute">
          {RU_DT.format(appt.createdAt)}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* ── Left column: dossier cards ─────────────────────────── */}
        <div className="flex flex-col gap-6">
          <Reveal>
            <Card className="p-6 sm:p-8">
              <CardEyebrow className="mb-3">
                {t.detail.clientHeading}
              </CardEyebrow>
              <p className="text-base text-ink">{appt.user.name}</p>
              <p className="mt-1 text-sm text-mute">
                <a
                  href={`mailto:${appt.user.email}`}
                  className="transition-colors hover:text-ink"
                >
                  {appt.user.email}
                </a>
                {appt.user.phone ? (
                  <>
                    {" · "}
                    <a
                      href={`tel:${ruPhoneHref(appt.user.phone)}`}
                      className="transition-colors hover:text-ink"
                    >
                      {formatRuPhone(appt.user.phone)}
                    </a>
                  </>
                ) : null}
              </p>
            </Card>
          </Reveal>

          <Reveal delay={0.06}>
            <Card className="p-6 sm:p-8">
              <CardEyebrow className="mb-3">
                {t.detail.serviceHeading}
              </CardEyebrow>
              {appt.service ? (
                <p className="text-base text-ink">
                  {appt.service.name}
                  <span className="text-mute">
                    {" · "}
                    {formatPrice(appt.service.price.toString())} ·{" "}
                    {formatDuration(appt.service.durationMin)}
                  </span>
                </p>
              ) : (
                <p className="text-mute">{t.detail.noService}</p>
              )}
            </Card>
          </Reveal>

          <Reveal delay={0.12}>
            <Card className="p-6 sm:p-8">
              <CardEyebrow className="mb-3">{t.detail.slotHeading}</CardEyebrow>
              {appt.slot ? (
                <p className="text-base text-ink">
                  {RU_DT.format(appt.slot.startsAt)} –{" "}
                  {RU_TIME.format(appt.slot.endsAt)}
                </p>
              ) : (
                <p className="text-mute">{t.noSlot}</p>
              )}
            </Card>
          </Reveal>

          {appt.bookings.length > 0 ? (
            <Reveal delay={0.18}>
              <Card className="p-6 sm:p-8">
                <CardEyebrow className="mb-3">{t.linkedBookings}</CardEyebrow>
                <ul className="flex flex-col">
                  {appt.bookings.map((b) => (
                    <li
                      key={b.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 py-2.5 first:pt-0 last:border-0 last:pb-0"
                    >
                      <BookingStatusBadge status={b.status} />
                      <Link
                        href={`/admin/bookings/${b.id}`}
                        className="min-w-0 flex-1 truncate text-sm text-ink transition-colors hover:text-mute"
                      >
                        {b.jewelry.name}
                      </Link>
                      <span className="text-xs text-mute">
                        {formatPrice(b.jewelry.price.toString())}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>
          ) : null}
        </div>

        {/* ── Right column: status stepper + transition rail ─────── */}
        <Reveal delay={0.1} className="h-fit lg:sticky lg:top-8">
          <Card className="p-6">
            <AppointmentStatusStepper status={appt.status} />
            <Separator className="my-6" />
            <AppointmentTransitionForm
              appointmentId={appt.id}
              status={appt.status}
              initialNotes={appt.notes}
            />
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
