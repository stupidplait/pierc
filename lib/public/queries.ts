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
import { firstPhotoUrl } from "@/lib/jewelry/format";
import {
  piercingCountForType,
  type JewelryWire,
  type JewelryType,
} from "@/lib/catalog/types";

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

// Published jewelry for the public /catalog showroom. Admin-edited and identical
// for every visitor, so it's cached across requests (like services/gallery/faq)
// — sparing Neon the findMany + includes on each (already dynamic, per-user)
// catalog render. Mapped to the plain JewelryWire shape here so the cached value
// round-trips cleanly (Decimal price → string). Busted by revalidateTag("jewelry")
// in the jewelry admin actions (upsert / delete / glb / stock); the 5-min TTL is
// the backstop for the async generation + cron paths that don't go through them.
/** Coerce a Prisma JSON value into a {x,y,z} or null — for the per-binding
 *  orientation nudge (JewelryAnchorBinding.rotationOffset). */
function coerceVec3(v: unknown): { x: number; y: number; z: number } | null {
  if (v && typeof v === "object" && "x" in v && "y" in v && "z" in v) {
    const o = v as Record<string, unknown>;
    return { x: Number(o.x) || 0, y: Number(o.y) || 0, z: Number(o.z) || 0 };
  }
  return null;
}

export const getPublishedJewelry = unstable_cache(
  async (): Promise<JewelryWire[]> => {
    const rows = await prisma.jewelry.findMany({
      where: { status: "PUBLISHED" },
      include: {
        category: { select: { name: true } },
        anchorBindings: {
          select: { anchorId: true, order: true, rotationOffset: true },
          orderBy: { order: "asc" },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      // Safety ceiling far above the real catalog size (~300) so the RSC payload
      // + Postgres scan stay bounded. The 3D showroom needs the full published
      // set, so this is a cap, not pagination. Matches the admin list caps.
      take: 500,
    });
    return rows.map((j) => {
      const bindings = j.anchorBindings.map((b) => ({
        anchorId: b.anchorId,
        order: b.order,
        rotationOffset: coerceVec3(b.rotationOffset),
      }));
      const anchorIds = Array.from(new Set(bindings.map((b) => b.anchorId)));
      const type = j.type as JewelryType;
      return {
        id: j.id,
        name: j.name,
        price: j.price.toString(),
        inStock: j.inStock,
        photo: firstPhotoUrl(j.photos),
        glbUrl: j.glbUrl,
        glbScale: j.glbScale ?? 1,
        spriteUrl: j.spriteUrl ?? null,
        categoryName: j.category.name,
        description: j.description,
        material: j.material,
        gauge: j.gauge,
        size: j.size,
        color: j.color,
        stones: j.stones,
        type,
        anchorBindings: bindings,
        anchorIds,
        piercingCount: piercingCountForType(type, bindings.length),
      };
    });
  },
  ["jewelry-published"],
  { tags: ["jewelry"], revalidate: 300 },
);

// Plain, client-serializable shape for the public gallery coverflow.
export type PublicGalleryPhoto = { id: string; url: string; caption: string | null };

// Published gallery photos for the public /gallery coverflow, ordered exactly
// as the admin board arranges them (manual `order`, newest first as a
// tiebreaker — mirrors the admin loader). Admin-edited and identical for every
// visitor, so it's cached across requests like getPublishedServices and busted
// by `revalidateTag("gallery")` on any gallery create / update / reorder /
// delete / replace in the content actions.
export const getGalleryPhotos = unstable_cache(
  async (): Promise<PublicGalleryPhoto[]> => {
    const rows = await prisma.galleryPhoto.findMany({
      where: { published: true },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      select: { id: true, url: true, caption: true },
    });
    return rows;
  },
  ["gallery-published"],
  { tags: ["gallery"] },
);

// Plain shape for the public /faq page.
export type PublicFaqItem = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
};

// Published FAQ items for the public /faq page. Admin-edited and identical for
// every visitor, so cached across requests (like services/gallery above) and
// busted by `revalidateTag("faq")` in the FAQ content actions (upsert / reorder
// / delete). Lets /faq drop force-dynamic and stop querying Neon per request.
export const getPublishedFaqItems = unstable_cache(
  async (): Promise<PublicFaqItem[]> => {
    return await prisma.fAQItem.findMany({
      where: { published: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, question: true, answer: true, category: true },
    });
  },
  ["faq-published"],
  { tags: ["faq"] },
);

// ── Public /about reads (cross-request cached, tag-busted) ───────────────────
// The About page's CMS body, the public Settings fields it renders (contacts +
// LocalBusiness JSON-LD), and the featured testimonials are all admin-edited and
// identical for every visitor — so, like services/gallery/faq above, they're
// cached across requests rather than re-queried on every view. This lets /about
// drop `force-dynamic` and stop hitting Neon per request; the admin actions bust
// these via revalidateTag("about" | "settings" | "reviews").

export const getAboutBody = unstable_cache(
  async (): Promise<string> => {
    const row = await prisma.siteContent.findUnique({ where: { key: "about" } });
    return (row?.content as { body?: string } | null)?.body ?? "";
  },
  ["about-content"],
  { tags: ["about"] },
);

// Only the Settings columns the public /about page actually renders — keeps the
// cached value lean + plain-serializable (no Decimal/Date columns round-tripped).
export type PublicContactSettings = {
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  instagramUrl: string | null;
  telegramUrl: string | null;
  workingHoursHint: string | null;
};

export const getPublicSettings = unstable_cache(
  async (): Promise<PublicContactSettings | null> => {
    return await prisma.settings.findUnique({
      where: { id: "default" },
      select: {
        contactEmail: true,
        contactPhone: true,
        contactAddress: true,
        instagramUrl: true,
        telegramUrl: true,
        workingHoursHint: true,
      },
    });
  },
  ["public-contact-settings"],
  { tags: ["settings"] },
);

// Featured, published testimonials for the /about wall. Serialized to the same
// plain shape the client TestimonialCard consumes (Date → ISO string).
export type FeaturedTestimonial = {
  id: string;
  rating: number;
  text: string;
  authorName: string;
  photoUrl: string | null;
  verified: boolean;
  publishedAt: string | null;
};

export const getFeaturedTestimonials = unstable_cache(
  async (): Promise<FeaturedTestimonial[]> => {
    const rows = await prisma.review.findMany({
      where: { status: "PUBLISHED", featured: true },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 6,
      select: {
        id: true,
        rating: true,
        text: true,
        authorName: true,
        photoUrl: true,
        appointmentId: true,
        publishedAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      text: r.text,
      authorName: r.authorName,
      photoUrl: r.photoUrl,
      verified: r.appointmentId != null,
      publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    }));
  },
  ["about-featured-reviews"],
  { tags: ["reviews"] },
);
