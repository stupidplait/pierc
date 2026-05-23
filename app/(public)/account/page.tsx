import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { getCachedPublicUser } from "@/lib/public/queries";
import { signOutPublicAction } from "@/lib/user/auth-actions";
import { formatPrice } from "@/lib/jewelry/format";

export const metadata: Metadata = {
  title: `${ru.pages.account.title} — ${ru.studio.name}`,
};

const RU_DT = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const BOOKING_STATUS_LABEL = ru.admin.statusLabels.booking;
const APPT_STATUS_LABEL = ru.admin.statusLabels.appointment;

export default async function AccountPage() {
  // Defense in depth — middleware already redirects unauth visitors.
  const user = await getCachedPublicUser();
  if (!user) redirect("/auth/sign-in?callbackUrl=/account");

  const [bookings, appointments] = await Promise.all([
    prisma.jewelryBooking.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        jewelry: { select: { id: true, name: true, price: true } },
      },
    }),
    prisma.appointment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { slot: true },
    }),
  ]);

  const t = ru.pages.account;
  const empty = bookings.length === 0 && appointments.length === 0;

  return (
    <Section>
      <PageHeader
        eyebrow={user.email}
        title={user.name || t.title}
        lead={t.lead}
      >
        <form action={signOutPublicAction}>
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-full border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary"
          >
            {t.logout}
          </button>
        </form>
      </PageHeader>

      {empty ? (
        <Card>
          <p className="text-mute">{t.empty}</p>
          <Link
            href="/catalog"
            className="mt-4 inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-medium text-on-primary hover:bg-primary-soft"
          >
            {ru.pages.home.hero.skipToCatalog} →
          </Link>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {appointments.length > 0 ? (
            <Card>
              <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-mute">
                {t.appointmentsHeading}
              </h2>
              <ul className="flex flex-col divide-y divide-line">
                {appointments.map((a) => (
                  <li key={a.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium text-ink">
                      {a.slot ? RU_DT.format(a.slot.startsAt) : t.noSlot}
                    </p>
                    <p className="text-xs text-mute">
                      {APPT_STATUS_LABEL[a.status]}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {bookings.length > 0 ? (
            <Card>
              <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-mute">
                {t.bookingsHeading}
              </h2>
              <ul className="flex flex-col divide-y divide-line">
                {bookings.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {b.jewelry.name}
                      </p>
                      <p className="text-xs text-mute">
                        {BOOKING_STATUS_LABEL[b.status]}
                      </p>
                    </div>
                    <p className="text-xs text-mute">
                      {formatPrice(b.jewelry.price.toString())}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}
    </Section>
  );
}
