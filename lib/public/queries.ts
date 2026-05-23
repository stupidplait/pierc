// React.cache wrappers around shared per-request reads. The catalog page
// + landing both render the public layout (Header/Footer) and may also
// trigger the same `auth()` and Settings reads inside their own RSC
// trees. Wrapping with `cache()` deduplicates within a request — without
// it, every Header + Footer render hits Postgres + the auth provider.

import { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentPublicUser, type PublicSessionUser } from "@/lib/auth-helpers";

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
