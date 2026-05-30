"use server";

import { prisma } from "@/lib/prisma";
import { firstPhotoUrl } from "@/lib/jewelry/format";
import type { WizardJewelry, WizardSlot } from "./wizard-types";

// Isolate the clock read in a helper so it never sits in a component render
// body (React Compiler purity rule).
function nowDate(): Date {
  return new Date();
}

// Open, future, not-yet-booked slots. Lazy-loaded by the catalog drawer when
// the "add a piercing time" toggle is switched on; the /book wizard fetches
// the same set server-side and passes it as a prop.
export async function getOpenSlots(): Promise<WizardSlot[]> {
  const slots = await prisma.availabilitySlot.findMany({
    where: {
      isOpen: true,
      startsAt: { gte: nowDate() },
      appointment: null,
    },
    orderBy: { startsAt: "asc" },
    take: 100,
  });

  return slots.map((s) => ({
    id: s.id,
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt.toISOString(),
  }));
}

// Everything the appointment drawer needs once it opens: open slots plus the
// published jewelry list for the optional "add jewelry" step. Lazy-loaded so
// the services page stays lean for visitors who never open the drawer.
export async function getBookingExtras(): Promise<{
  slots: WizardSlot[];
  jewelry: WizardJewelry[];
}> {
  const [slots, jewelryDb] = await Promise.all([
    getOpenSlots(),
    prisma.jewelry.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ inStock: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        price: true,
        photos: true,
        inStock: true,
      },
    }),
  ]);

  const jewelry: WizardJewelry[] = jewelryDb.map((j) => ({
    id: j.id,
    name: j.name,
    price: j.price.toString(),
    photo: firstPhotoUrl(j.photos),
    inStock: j.inStock,
  }));

  return { slots, jewelry };
}
