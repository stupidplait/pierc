import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatRuPhone } from "@/lib/phone";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";
import { ru } from "@/lib/i18n/ru";
import { formatPrice } from "@/lib/jewelry/format";
import { Reveal } from "@/components/admin/form/atelier";
import { Card } from "@/components/shadcn/ui/card";
import { Input } from "@/components/shadcn/ui/input";
import { Button } from "@/components/shadcn/ui/button";
import {
  BOOKING_STATUSES,
  groupBookingsByDay,
  type BookingItem,
  type BookingStatus,
} from "@/lib/admin/bookings-view";
import {
  BookingsConsole,
  type ConsoleBookingDetail,
} from "@/components/admin/bookings/views/BookingsConsole";

export const metadata: Metadata = {
  title: ru.admin.bookings.title,
};

const RU_DT = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

interface Props {
  searchParams: Promise<{ status?: string; q?: string; sel?: string }>;
}

export default async function AdminBookingsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = BOOKING_STATUSES.includes(sp.status as BookingStatus)
    ? (sp.status as BookingStatus)
    : "";
  const q = (sp.q ?? "").trim();

  // Search spans the linked jewelry name + the client's name/email, so the box
  // finds a booking whether the admin remembers the piece or the person.
  const where: Prisma.JewelryBookingWhereInput = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { jewelry: { name: { contains: q, mode: "insensitive" } } },
      { user: { name: { contains: q, mode: "insensitive" } } },
      { user: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  const todayStart = startOfToday();
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  // List honours the active filter; the chip counts are unfiltered totals (each
  // chip always shows its own total) — same convention as the appointments
  // console.
  const [bookings, grouped, todayCount] = await Promise.all([
    prisma.jewelryBooking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        jewelry: { select: { name: true, price: true, material: true } },
        user: { select: { name: true, email: true, phone: true } },
      },
      take: 200,
    }),
    prisma.jewelryBooking.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.jewelryBooking.count({
      where: { createdAt: { gte: todayStart } },
    }),
  ]);

  const counts: Record<BookingStatus, number> = {
    RESERVED: 0,
    CONFIRMED: 0,
    FULFILLED: 0,
    CANCELLED: 0,
  };
  for (const g of grouped) counts[g.status] = g._count._all;
  const total = BOOKING_STATUSES.reduce((sum, s) => sum + counts[s], 0);

  const items: BookingItem[] = bookings.map((b) => ({
    id: b.id,
    status: b.status,
    jewelryName: b.jewelry.name,
    material: b.jewelry.material,
    price: formatPrice(b.jewelry.price.toString()),
    clientName: b.user.name,
    clientContact: [
      b.user.email,
      b.user.phone ? formatRuPhone(b.user.phone) : null,
    ]
      .filter(Boolean)
      .join(" · "),
    createdAt: b.createdAt,
  }));

  const groups = groupBookingsByDay(items, todayStart, yesterdayStart);

  const t = ru.admin.bookings;

  // Console selection — the open booking's full dossier. Falls back to the first
  // row when ?sel is missing or stale.
  let selected: ConsoleBookingDetail | null = null;
  let selectedId: string | null = null;
  if (items.length > 0) {
    selectedId =
      sp.sel && items.some((i) => i.id === sp.sel) ? sp.sel : items[0].id;
    selected = await loadConsoleBooking(selectedId);
    if (!selected) selectedId = null;
  }

  /** Build a list URL, carrying whichever facets are still active. */
  const buildHref = (next: {
    status?: string;
    q?: string;
    sel?: string;
  }): string => {
    const params = new URLSearchParams();
    const s = next.status ?? status;
    const query = next.q ?? q;
    if (s) params.set("status", s);
    if (query) params.set("q", query);
    if (next.sel) params.set("sel", next.sel);
    const qs = params.toString();
    return qs ? `/admin/bookings?${qs}` : "/admin/bookings";
  };

  const statusOptions = [
    { value: "", label: t.statusAny, count: total },
    ...BOOKING_STATUSES.map((s) => ({
      value: s,
      label: ru.admin.statusLabels.booking[s],
      count: counts[s],
    })),
  ];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-8 pt-2 sm:mb-10 sm:pt-4">
        <h1 className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          {t.title}
        </h1>
        <p className="mt-3 text-base text-mute">{t.lead}</p>
      </header>

      {/* ── Summary strip ─────────────────────────────────────────── */}
      <Reveal className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        <SummaryCard label={t.summaryTotal} value={total} />
        <SummaryCard label={t.summaryReserved} value={counts.RESERVED} accent />
        <SummaryCard label={t.summaryToday} value={todayCount} />
      </Reveal>

      {/* ── Filters: status segments + search ─────────────────────── */}
      <Reveal delay={0.06} className="mb-7 flex flex-col gap-3">
        <div className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-line bg-card p-1">
          {statusOptions.map((opt) => {
            const active = opt.value === status;
            return (
              <Link
                key={opt.value || "any"}
                href={buildHref({ status: opt.value })}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  active ? "bg-ink text-bg" : "text-mute hover:text-ink"
                }`}
              >
                <span>{opt.label}</span>
                <span
                  className={`text-xs tabular-nums ${
                    active ? "text-bg/65" : "text-mute/65"
                  }`}
                >
                  {opt.count}
                </span>
              </Link>
            );
          })}
        </div>

        <form
          method="get"
          action="/admin/bookings"
          className="flex items-center gap-2"
        >
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <div className="relative flex-1 sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute/50" />
            <Input
              name="q"
              defaultValue={q}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchLabel}
              className="h-9 pl-9"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            {t.searchAction}
          </Button>
          {q ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={buildHref({ q: "" })} scroll={false}>
                {t.clear}
              </Link>
            </Button>
          ) : null}
        </form>
      </Reveal>

      {/* ── Console ───────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <Reveal delay={0.1}>
          <Card className="px-6 py-16 text-center">
            <p className="text-sm text-mute">{q || status ? t.emptyFiltered : t.empty}</p>
          </Card>
        </Reveal>
      ) : (
        <Reveal delay={0.1}>
          <BookingsConsole
            groups={groups}
            selected={selected}
            selectedId={selectedId}
            buildSelHref={(id) => buildHref({ sel: id })}
          />
        </Reveal>
      )}
    </div>
  );
}

/** Full dossier for the console's open row — mirrors the detail page's query. */
async function loadConsoleBooking(
  id: string,
): Promise<ConsoleBookingDetail | null> {
  const b = await prisma.jewelryBooking.findUnique({
    where: { id },
    include: {
      jewelry: { select: { id: true, name: true, price: true, material: true } },
      user: { select: { name: true, email: true, phone: true } },
      appointment: {
        select: { id: true, slot: { select: { startsAt: true } } },
      },
    },
  });
  if (!b) return null;

  return {
    id: b.id,
    status: b.status,
    createdAtLabel: RU_DT.format(b.createdAt),
    jewelryId: b.jewelry.id,
    jewelryName: b.jewelry.name,
    jewelryMaterial: b.jewelry.material,
    jewelryPrice: formatPrice(b.jewelry.price.toString()),
    clientName: b.user.name,
    clientEmail: b.user.email,
    clientPhone: b.user.phone,
    appointment: b.appointment
      ? {
          id: b.appointment.id,
          slotLabel: b.appointment.slot
            ? RU_DT.format(b.appointment.slot.startsAt)
            : null,
        }
      : null,
    notes: b.notes,
  };
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-xs text-mute">{label}</p>
      <p
        className={`mt-1 text-2xl font-medium tabular-nums ${
          accent && value > 0 ? "text-accent" : "text-ink"
        }`}
      >
        {value}
      </p>
    </Card>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
