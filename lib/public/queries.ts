// React.cache wrappers around shared per-request reads. The catalog page
// + landing both render the public layout (Header/Footer) and may also
// trigger the same `auth()` and Settings reads inside their own RSC
// trees. Wrapping with `cache()` deduplicates within a request — without
// it, every Header + Footer render hits Postgres + the auth provider.

import { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getCurrentPublicUser,
  getCurrentPublicAdmin,
  type PublicSessionUser,
  type PublicAdmin,
} from "@/lib/auth-helpers";

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
