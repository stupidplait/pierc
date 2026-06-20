import type { Metadata } from "next";
import { cache } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatRuPhone, ruPhoneHref } from "@/lib/phone";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { Button } from "@/components/shadcn/ui/button";
import { CARD } from "@/components/admin/form/styles";
import { Reveal } from "@/components/admin/form/atelier";
import { BookingStatusBadge } from "@/components/admin/StatusBadges";
import { BookingTransitionForm } from "@/components/admin/BookingTransitionForm";
import { formatPrice } from "@/lib/jewelry/format";

const RU_DT = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

interface Props {
  params: Promise<{ id: string }>;
}

// Dedup the row read across generateMetadata + the page body within one request.
const getBooking = cache((id: string) =>
  prisma.jewelryBooking.findUnique({
    where: { id },
    include: {
      jewelry: { select: { id: true, name: true, price: true, material: true } },
      user: { select: { id: true, name: true, email: true, phone: true } },
      appointment: {
        select: {
          id: true,
          status: true,
          slot: { select: { startsAt: true, endsAt: true } },
        },
      },
    },
  }),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const b = await getBooking(id);
  return {
    title: b?.jewelry?.name ?? ru.admin.bookings.detail.title,
  };
}

export default async function AdminBookingDetailPage({ params }: Props) {
  const { id } = await params;
  const booking = await getBooking(id);

  if (!booking) notFound();
  const t = ru.admin.bookings;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-10 flex flex-col gap-4 pt-2 sm:mb-12 sm:flex-row sm:items-end sm:justify-between sm:pt-4">
        <h1 className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          {t.detail.title}
        </h1>
        <Button asChild variant="ghost" size="sm" className="shrink-0">
          <Link href="/admin/bookings">← {t.backToList}</Link>
        </Button>
      </header>

      <Reveal>
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* ── Dossier: status + client + jewelry + appointment ─────── */}
          <div className={`${CARD} divide-y divide-line/70 overflow-hidden`}>
            <div className="flex flex-wrap items-center gap-3 px-7 py-5 sm:px-8">
              <BookingStatusBadge status={booking.status} />
              <span className="text-xs text-mute tabular-nums">
                {RU_DT.format(booking.createdAt)}
              </span>
            </div>

            <Section title={t.detail.clientHeading}>
              <p className="text-base text-ink">{booking.user.name}</p>
              <p className="mt-1.5 text-sm text-mute">
                <a
                  href={`mailto:${booking.user.email}`}
                  className="transition-colors hover:text-accent"
                >
                  {booking.user.email}
                </a>
                {booking.user.phone ? (
                  <>
                    {" · "}
                    <a
                      href={`tel:${ruPhoneHref(booking.user.phone)}`}
                      className="transition-colors hover:text-accent"
                    >
                      {formatRuPhone(booking.user.phone)}
                    </a>
                  </>
                ) : null}
              </p>
            </Section>

            <Section title={t.detail.jewelryHeading}>
              <Link
                href={`/admin/jewelry/${booking.jewelry.id}/edit`}
                className="text-base font-medium text-ink transition-colors hover:text-accent"
              >
                {booking.jewelry.name}
              </Link>
              <p className="mt-1.5 text-sm text-mute">
                {booking.jewelry.material} ·{" "}
                {formatPrice(booking.jewelry.price.toString())}
              </p>
            </Section>

            {booking.appointment ? (
              <Section title={t.detail.appointmentHeading}>
                <Link
                  href={`/admin/appointments/${booking.appointment.id}`}
                  className="text-base text-ink transition-colors hover:text-accent"
                >
                  {booking.appointment.slot
                    ? RU_DT.format(booking.appointment.slot.startsAt)
                    : ru.admin.appointments.noSlot}
                </Link>
              </Section>
            ) : null}
          </div>

          {/* ── Status transition + admin notes ──────────────────────── */}
          <div className={`${CARD} h-fit p-7 sm:p-8`}>
            <BookingTransitionForm
              bookingId={booking.id}
              status={booking.status}
              initialNotes={booking.notes}
            />
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/** One labelled block of the dossier card — small-caps heading over content,
 *  matching the section labels used across the redesigned admin. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-7 py-6 sm:px-8">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-mute">
        {title}
      </h2>
      {children}
    </section>
  );
}
