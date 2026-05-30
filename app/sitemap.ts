import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

// Skip build-time prerender — enumerates Jewelry rows for the URL list.
export const dynamic = "force-dynamic";

/**
 * Public sitemap. Next.js serves this at `/sitemap.xml` and references
 * it from `robots.ts`. See docs/17-seo.md.
 *
 * Includes:
 *   - Static public pages
 *   - Every published jewelry detail page (with `lastModified` from
 *     the `Jewelry.updatedAt` column for freshness signals)
 *
 * Excludes (also disallowed in robots.ts):
 *   /admin, /account, /auth, /api, /book/success, /review/*
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Static public routes. `priority` is a relative hint; we keep the
  // home + catalog at 1.0 and let everything else fall to 0.7.
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${APP_URL}/`, lastModified: now, priority: 1.0 },
    { url: `${APP_URL}/catalog`, lastModified: now, priority: 1.0 },
    { url: `${APP_URL}/about`, lastModified: now, priority: 0.7 },
    { url: `${APP_URL}/services`, lastModified: now, priority: 0.7 },
    { url: `${APP_URL}/gallery`, lastModified: now, priority: 0.7 },
    { url: `${APP_URL}/faq`, lastModified: now, priority: 0.7 },
    { url: `${APP_URL}/book`, lastModified: now, priority: 0.7 },
  ];

  // Dynamic per-jewelry detail pages.
  const jewelry = await prisma.jewelry.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, updatedAt: true },
  });

  const jewelryEntries: MetadataRoute.Sitemap = jewelry.map((j) => ({
    url: `${APP_URL}/catalog/${j.id}`,
    lastModified: j.updatedAt,
    priority: 0.6,
  }));

  return [...staticEntries, ...jewelryEntries];
}
