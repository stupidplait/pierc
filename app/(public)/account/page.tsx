import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { getCachedPublicUser } from "@/lib/public/queries";
import { formatPrice } from "@/lib/jewelry/format";
import { getBotUsername } from "@/lib/notifications/telegram";
import { signTelegramLinkToken } from "@/lib/telegram/link-token";
import { AccountView } from "@/components/account/AccountView";

// Skip build-time prerender — reads live data via Prisma.
export const dynamic = "force-dynamic";

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

const RU_SHORT = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
});

// Read the request-time clock outside the component body so the purity lint
// rule doesn't flag a (legitimate) Date.now() in a force-dynamic server page.
function nowMs(): number {
  return Date.now();
}

// TEMP — exposes a dev-only "toggle Telegram" control to preview the connected
// state without the real bot. Off in production.
const DEV = process.env.NODE_ENV !== "production";

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function countdownLabel(startsAtMs: number, now: number): string {
  const days = Math.round((startOfDay(startsAtMs) - startOfDay(now)) / 86_400_000);
  if (days <= 0) return ru.pages.account.today;
  if (days === 1) return ru.pages.account.tomorrow;
  return ru.pages.account.inDays.replace("{n}", String(days));
}

export default async function AccountPage() {
  // Defense in depth — middleware already redirects unauth visitors.
  const user = await getCachedPublicUser();
  if (!user) redirect("/auth/sign-in?callbackUrl=/account");

  // Appointments carry their jewelry bookings (the parent→child relation that
  // the account UI groups as accordions). Standalone reservations are bookings
  // not attached to any appointment.
  const [appointments, standalone, profile] = await Promise.all([
    prisma.appointment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        slot: true,
        service: { select: { name: true } },
        bookings: {
          orderBy: { createdAt: "asc" },
          include: { jewelry: { select: { id: true, name: true, price: true } } },
        },
      },
    }),
    prisma.jewelryBooking.findMany({
      where: { userId: user.id, appointmentId: null },
      orderBy: { createdAt: "desc" },
      include: { jewelry: { select: { id: true, name: true, price: true } } },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        name: true,
        email: true,
        phone: true,
        telegram: true,
        telegramChatId: true,
      },
    }),
  ]);

  const t = ru.pages.account;
  const now = nowMs();

  // Plain, display-ready, serializable shapes (no Date / Decimal cross the
  // client boundary).
  const appointmentEntries = appointments.map((a) => {
    // Prefer the live slot time; once a slot is released on cancellation we
    // fall back to the snapshot captured at that moment (scheduledAt), so the
    // date survives. Only a truly slot-less booking shows no time.
    const when = a.slot?.startsAt ?? a.scheduledAt ?? null;
    return {
      id: a.id,
      slotLabel: when ? RU_DT.format(when) : null,
      serviceName: a.service?.name ?? null,
      shortDate: RU_SHORT.format(a.createdAt),
      sortMs: a.createdAt.getTime(),
      startsAtMs: when ? when.getTime() : null,
      status: a.status,
      canCancel: a.status === "PENDING",
      pieces: a.bookings.map((b) => ({
        id: b.id,
        name: b.jewelry.name,
        price: formatPrice(b.jewelry.price.toString()),
        status: b.status,
        canCancel: b.status === "RESERVED",
      })),
    };
  });

  const standaloneBookings = standalone.map((b) => ({
    id: b.id,
    name: b.jewelry.name,
    price: formatPrice(b.jewelry.price.toString()),
    shortDate: RU_SHORT.format(b.createdAt),
    sortMs: b.createdAt.getTime(),
    status: b.status,
    canCancel: b.status === "RESERVED",
  }));

  // Soonest upcoming appointment drives the pinned head node.
  const upcoming = appointments
    .filter((a) => a.slot && a.slot.startsAt.getTime() > now)
    .sort((x, y) => x.slot!.startsAt.getTime() - y.slot!.startsAt.getTime())[0];

  const nextAppointment = upcoming
    ? {
        id: upcoming.id,
        countdownLabel: countdownLabel(upcoming.slot!.startsAt.getTime(), now),
      }
    : null;

  // Telegram connect deep-link — only when the bot is reachable and the user
  // hasn't already linked a chat.
  const telegramConnected = Boolean(profile?.telegramChatId);
  let telegramConnectUrl: string | null = null;
  if (!telegramConnected) {
    const botUsername = await getBotUsername();
    if (botUsername) {
      const token = await signTelegramLinkToken(user.id);
      telegramConnectUrl = `https://t.me/${botUsername}?start=${token}`;
    }
  }

  return (
    <AccountView
      userName={profile?.name || user.name || t.title}
      email={profile?.email || user.email}
      phone={profile?.phone ?? null}
      telegram={profile?.telegram ?? null}
      telegramConnected={telegramConnected}
      telegramConnectUrl={telegramConnectUrl}
      dev={DEV}
      appointments={appointmentEntries}
      standaloneBookings={standaloneBookings}
      nextAppointment={nextAppointment}
    />
  );
}
