import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { cancelAppointmentInTx, cancelBookingInTx } from "@/lib/booking/cancel";

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

const EXPIRY_HOURS = 48;

export async function GET(request: Request) {
  if (!authorize(request)) {
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
      console.error("[cron expire] appointment", a.id, err);
    }
  }

  for (const b of staleBookings) {
    try {
      await prisma.$transaction((tx) => cancelBookingInTx(tx, b.id));
      bookingsCancelled += 1;
    } catch (err) {
      console.error("[cron expire] booking", b.id, err);
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

  return NextResponse.json({
    ok: true,
    cutoff: cutoff.toISOString(),
    appointmentsCancelled,
    bookingsCancelled,
  });
}

function authorize(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // dev / unconfigured mode
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}
