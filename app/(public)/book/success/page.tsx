import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/shadcn/ui/card";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/jewelry/format";

export const metadata: Metadata = {
  title: `${ru.pages.bookSuccess.title} — ${ru.studio.name}`,
  // Per-booking landing — keep it out of search indexes (defense in depth;
  // robots.txt also disallows /book/success).
  robots: { index: false },
};

const RU_DATE = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

interface BookSuccessProps {
  searchParams: Promise<{
    ids?: string;
    apt?: string;
  }>;
}

export default async function BookSuccessPage({ searchParams }: BookSuccessProps) {
  const sp = await searchParams;
  const bookingIds: string[] = [];
  for (const s of (sp.ids ?? "").split(",")) {
    const t = s.trim();
    if (t) bookingIds.push(t);
  }
  const appointmentId = sp.apt ?? null;

  const [bookings, appointment] = await Promise.all([
    bookingIds.length > 0
      ? prisma.jewelryBooking.findMany({
          where: { id: { in: bookingIds } },
          include: {
            jewelry: { select: { id: true, name: true, price: true } },
          },
        })
      : Promise.resolve([]),
    appointmentId
      ? prisma.appointment.findUnique({
          where: { id: appointmentId },
          include: { slot: true },
        })
      : Promise.resolve(null),
  ]);

  const t = ru.pages.bookSuccess;

  return (
    <Section>
      <PageHeader title={t.title} lead={t.lead} />
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        {bookings.length > 0 ? (
          <Card className="p-6 sm:p-8">
            <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-mute">
              {t.summaryJewelry}
            </h2>
            <ul className="flex flex-col gap-2">
              {bookings.map((b) => (
                <li
                  key={b.id}
                  className="flex justify-between border-b border-line pb-2 text-sm text-ink last:border-0 last:pb-0"
                >
                  <span>{b.jewelry.name}</span>
                  <span className="text-mute tabular-nums">
                    {formatPrice(b.jewelry.price.toString())}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card className="p-6 sm:p-8">
            <p className="text-sm text-mute">{t.noJewelry}</p>
          </Card>
        )}

        {appointment?.slot ? (
          <Card className="p-6 sm:p-8">
            <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-mute">
              {t.summarySlot}
            </h2>
            <p className="text-base text-ink">
              {RU_DATE.format(appointment.slot.startsAt)}
            </p>
          </Card>
        ) : (
          <Card className="p-6 sm:p-8">
            <p className="text-sm text-mute">{t.noSlot}</p>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button href="/catalog">{t.backToCatalog}</Button>
          <Link
            href="/"
            className="text-sm text-mute hover:text-primary"
          >
            {t.backToHome}
          </Link>
        </div>
      </div>
    </Section>
  );
}
