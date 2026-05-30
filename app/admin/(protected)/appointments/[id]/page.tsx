import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatRuPhone, ruPhoneHref } from "@/lib/phone";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  AppointmentStatusBadge,
  BookingStatusBadge,
} from "@/components/admin/StatusBadges";
import { AppointmentTransitionForm } from "@/components/admin/AppointmentTransitionForm";
import { CARD } from "@/components/admin/form/styles";
import { Reveal } from "@/components/admin/form/atelier";
import { formatPrice } from "@/lib/jewelry/format";

// Quiet small-caps sub-header shared by every dossier card on this page.
const DOSSIER_HEADING =
  "mb-3 text-xs font-medium uppercase tracking-[0.2em] text-mute";

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const a = await prisma.appointment.findUnique({
    where: { id },
    select: { user: { select: { name: true } } },
  });
  return {
    title: `${a?.user?.name ?? ru.admin.appointments.detail.title} — ${ru.admin.panel}`,
  };
}

export default async function AdminAppointmentDetailPage({ params }: Props) {
  const { id } = await params;
  const appt = await prisma.appointment.findUnique({
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
  });
  if (!appt) notFound();

  const t = ru.admin.appointments;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader eyebrow={ru.admin.panel} title={t.detail.title}>
        <Button href="/admin/appointments" variant="ghost" size="sm">
          ← {t.backToList}
        </Button>
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <AppointmentStatusBadge status={appt.status} />
        <span className="text-xs text-mute">
          {RU_DT.format(appt.createdAt)}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* ── Left column ────────────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          <Reveal className={`${CARD} p-6 sm:p-8`}>
            <h2 className={DOSSIER_HEADING}>{t.detail.clientHeading}</h2>
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
          </Reveal>

          <Reveal delay={0.06} className={`${CARD} p-6 sm:p-8`}>
            <h2 className={DOSSIER_HEADING}>{t.detail.serviceHeading}</h2>
            {appt.service ? (
              <p className="text-base text-ink">
                {appt.service.name}
                <span className="text-mute">
                  {" · "}
                  {formatPrice(appt.service.price.toString())} ·{" "}
                  {appt.service.durationMin} мин
                </span>
              </p>
            ) : (
              <p className="text-mute">{t.detail.noService}</p>
            )}
          </Reveal>

          <Reveal delay={0.12} className={`${CARD} p-6 sm:p-8`}>
            <h2 className={DOSSIER_HEADING}>{t.detail.slotHeading}</h2>
            {appt.slot ? (
              <p className="text-base text-ink">
                {RU_DT.format(appt.slot.startsAt)} –{" "}
                {RU_TIME.format(appt.slot.endsAt)}
              </p>
            ) : (
              <p className="text-mute">{t.noSlot}</p>
            )}
          </Reveal>

          {appt.bookings.length > 0 ? (
            <Reveal delay={0.18} className={`${CARD} p-6 sm:p-8`}>
              <h2 className={DOSSIER_HEADING}>{t.linkedBookings}</h2>
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
            </Reveal>
          ) : null}
        </div>

        {/* ── Right column: status & notes rail ──────────────────── */}
        <Reveal delay={0.1} className={`${CARD} h-fit p-6 lg:sticky lg:top-8`}>
          <AppointmentTransitionForm
            appointmentId={appt.id}
            status={appt.status}
            initialNotes={appt.notes}
          />
        </Reveal>
      </div>
    </div>
  );
}
