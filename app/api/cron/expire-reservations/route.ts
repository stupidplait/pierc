import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { cancelAppointmentInTx, cancelBookingInTx } from "@/lib/booking/cancel";
import { authorizeCron } from "@/lib/cron-auth";
import { pruneRateLimits } from "@/lib/rate-limit";
import { reportError } from "@/lib/observability/logger";

// Vercel Cron — auto-releases stale, unconfirmed reservations so abandoned
// carts don't hold slots / stock forever:
//
//   PENDING appointments created > 48h ago  → cancelled (slot freed, linked
//                                              jewelry cancelled + restocked)
//   RESERVED standalone bookings > 48h ago   → cancelled (stock restored)
//
// Auth mirrors /api/cron/poll-jobs: require Bearer CRON_SECRET when set; open
// in dev so it can be hit with curl.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Cap wall-clock: this sweep runs up to 200+200 per-row transactions. Bound it so
// a backlog can't run unbounded; remaining rows are picked up on the next tick.
export const maxDuration = 60;

const EXPIRY_HOURS = 48;

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - EXPIRY_HOURS * 60 * 60 * 1000);

  const [staleAppointments, staleBookings] = await Promise.all([
    prisma.appointment.findMany({
      where: { status: "PENDING", createdAt: { lt: cutoff } },
      select: { id: true },
      take: 200,
    }),
    prisma.jewelryBooking.findMany({
      where: {
        status: "RESERVED",
        appointmentId: null,
        createdAt: { lt: cutoff },
      },
      select: { id: true },
      take: 200,
    }),
  ]);

  let appointmentsCancelled = 0;
  let bookingsCancelled = 0;

  for (const a of staleAppointments) {
    try {
      await prisma.$transaction((tx) => cancelAppointmentInTx(tx, a.id));
      appointmentsCancelled += 1;
    } catch (err) {
      reportError(err, { scope: "cron.expire.appointment", appointmentId: a.id });
    }
  }

  for (const b of staleBookings) {
    try {
      await prisma.$transaction((tx) => cancelBookingInTx(tx, b.id));
      bookingsCancelled += 1;
    } catch (err) {
      reportError(err, { scope: "cron.expire.booking", bookingId: b.id });
    }
  }

  if (appointmentsCancelled > 0 || bookingsCancelled > 0) {
    revalidatePath("/catalog");
    revalidatePath("/book");
    revalidatePath("/admin");
    revalidatePath("/admin/appointments");
    revalidatePath("/admin/bookings");
    revalidatePath("/admin/slots");
  }

  // Opportunistically reap expired rate-limit counters in the same daily tick.
  const rateLimitsPruned = await pruneRateLimits();

  return NextResponse.json({
    ok: true,
    cutoff: cutoff.toISOString(),
    appointmentsCancelled,
    bookingsCancelled,
    rateLimitsPruned,
  });
}
