import type { prisma } from "@/lib/prisma";

// Shared cancellation logic used by the admin panel, self-serve /account, and
// the expiry cron — so "cancel" means the same thing everywhere.

// The interactive-transaction client (the prisma instance minus lifecycle
// methods). Derived from the real client so its method arg types line up.
type Tx = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Cancel an appointment inside a transaction:
 *   - status → CANCELLED
 *   - release the slot (slotId → null) so the @unique constraint frees it for
 *     rebooking (just flipping status would leave the slot permanently held)
 *   - cascade-cancel still-active linked bookings (RESERVED / CONFIRMED) and
 *     restore their stock
 *
 * Idempotent: an appointment already in a terminal state is left untouched.
 * Returns how many linked bookings were cancelled.
 */
export async function cancelAppointmentInTx(
  tx: Tx,
  appointmentId: string,
): Promise<{ cancelledBookings: number }> {
  const appt = await tx.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      status: true,
      // Snapshot the slot time before we release it (below) so the date isn't
      // lost once slotId → null.
      slot: { select: { startsAt: true } },
      bookings: {
        where: { status: { in: ["RESERVED", "CONFIRMED"] } },
        select: { id: true, jewelryId: true },
      },
    },
  });
  if (!appt) throw new Error("Запись не найдена");
  if (
    appt.status === "CANCELLED" ||
    appt.status === "COMPLETED" ||
    appt.status === "NO_SHOW"
  ) {
    return { cancelledBookings: 0 };
  }

  await tx.appointment.update({
    where: { id: appointmentId },
    data: {
      status: "CANCELLED",
      slotId: null,
      // Preserve the booked time for display; only overwrite when we actually
      // had a slot (don't clobber an existing snapshot with null).
      ...(appt.slot ? { scheduledAt: appt.slot.startsAt } : {}),
    },
  });

  for (const b of appt.bookings) {
    await tx.jewelryBooking.update({
      where: { id: b.id },
      data: { status: "CANCELLED" },
    });
    await tx.jewelry.update({
      where: { id: b.jewelryId },
      data: { inStock: { increment: 1 } },
    });
  }

  return { cancelledBookings: appt.bookings.length };
}

/**
 * Cancel a single jewelry booking inside a transaction. Restores stock only
 * when leaving an active state (RESERVED / CONFIRMED); FULFILLED/CANCELLED are
 * left untouched (the customer kept the piece, or it's already cancelled).
 */
export async function cancelBookingInTx(
  tx: Tx,
  bookingId: string,
): Promise<{ restoredStock: boolean }> {
  const b = await tx.jewelryBooking.findUnique({
    where: { id: bookingId },
    select: { status: true, jewelryId: true },
  });
  if (!b) throw new Error("Бронирование не найдено");
  if (b.status === "CANCELLED" || b.status === "FULFILLED") {
    return { restoredStock: false };
  }

  await tx.jewelryBooking.update({
    where: { id: bookingId },
    data: { status: "CANCELLED" },
  });
  await tx.jewelry.update({
    where: { id: b.jewelryId },
    data: { inStock: { increment: 1 } },
  });

  return { restoredStock: true };
}
