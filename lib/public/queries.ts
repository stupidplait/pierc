// React.cache wrappers around shared per-request reads. The catalog page
// + landing both render the public layout (Header/Footer) and may also
// trigger the same `auth()` and Settings reads inside their own RSC
// trees. Wrapping with `cache()` deduplicates within a request — without
// it, every Header + Footer render hits Postgres + the auth provider.

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getCurrentPublicUser,
  getCurrentPublicAdmin,
  type PublicSessionUser,
  type PublicAdmin,
} from "@/lib/auth-helpers";
import type { WizardService } from "@/lib/booking/wizard-types";

export const getSettings = cache(async () => {
  return await prisma.settings.findUnique({ where: { id: "default" } });
});

export const getCachedSession = cache(async () => {
  return await auth();
});

export const getCachedPublicUser = cache(
  async (): Promise<PublicSessionUser | null> => {
    return await getCurrentPublicUser();
  },
);

export const getCachedPublicAdmin = cache(
  async (): Promise<PublicAdmin | null> => {
    return await getCurrentPublicAdmin();
  },
);

// Booking-form prefill: the session token only carries name/email, so reach
// into the User row for the saved phone. Returns null for guests. Wrapped in
// cache() so multiple booking surfaces in one render (e.g. catalog showroom)
// share a single read.
export const getBookingPrefillUser = cache(
  async (): Promise<{ name: string; email: string; phone: string | null } | null> => {
    const sessionUser = await getCurrentPublicUser();
    if (!sessionUser) return null;
    const profile = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { name: true, email: true, phone: true },
    });
    return {
      name: profile?.name || sessionUser.name,
      email: profile?.email || sessionUser.email,
      phone: profile?.phone ?? null,
    };
  },
);

// Published services for the public /services page. The list is admin-edited and
// identical for every visitor, so it's cached across requests (not just per
// request like the `cache()` helpers above) to spare Neon a query on every view
// — the page itself still renders dynamically for the per-user booking prefill.
// Normalized to the booking-wizard shape here (Decimal price → string) so the
// cached value is plain-serializable and round-trips cleanly. Invalidated by
// `revalidateTag("services")` in the admin content actions on any service
// create / update / reorder / delete.
export const getPublishedServices = unstable_cache(
  async (): Promise<WizardService[]> => {
    const rows = await prisma.service.findMany({
      where: { published: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price: s.price.toString(),
      durationMin: s.durationMin,
    }));
  },
  ["services-published"],
  { tags: ["services"] },
);
