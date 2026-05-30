"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCachedPublicUser } from "@/lib/public/queries";
import { cancelAppointmentInTx, cancelBookingInTx } from "@/lib/booking/cancel";
import { notifyAdminOfCancellation } from "@/lib/notifications";

// Self-serve cancellation from /account. Only un-confirmed reservations can be
// cancelled directly (PENDING appointments / RESERVED standalone bookings);
// once the admin has acted, the customer must contact the studio. Each action
// verifies ownership against the signed-in user.

export async function cancelMyAppointment(formData: FormData): Promise<void> {
  const user = await getCachedPublicUser();
  if (!user) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const appt = await prisma.appointment.findUnique({
    where: { id },
    select: { userId: true, status: true },
  });
  if (!appt || appt.userId !== user.id || appt.status !== "PENDING") return;

  await prisma.$transaction((tx) => cancelAppointmentInTx(tx, id));

  revalidatePath("/account");
  revalidatePath("/catalog");
  revalidatePath("/book");
  revalidatePath("/admin/appointments");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/slots");

  after(async () => {
    try {
      await notifyAdminOfCancellation({ kind: "appointment", id });
    } catch (err) {
      console.error("[account] cancel appointment notify failed:", err);
    }
  });
}

export async function cancelMyBooking(formData: FormData): Promise<void> {
  const user = await getCachedPublicUser();
  if (!user) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const booking = await prisma.jewelryBooking.findUnique({
    where: { id },
    select: { userId: true, status: true },
  });
  // Any RESERVED booking the user owns — standalone OR a single piece inside a
  // (still-unconfirmed) appointment. Cancelling one piece leaves the
  // appointment and its other pieces intact.
  if (!booking || booking.userId !== user.id || booking.status !== "RESERVED") {
    return;
  }

  await prisma.$transaction((tx) => cancelBookingInTx(tx, id));

  revalidatePath("/account");
  revalidatePath("/catalog");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/appointments");

  after(async () => {
    try {
      await notifyAdminOfCancellation({ kind: "booking", id });
    } catch (err) {
      console.error("[account] cancel booking notify failed:", err);
    }
  });
}
