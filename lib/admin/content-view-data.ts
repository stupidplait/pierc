import { prisma } from "@/lib/prisma";
import type { ContentData } from "./content-view";

/**
 * Server-only Prisma loader for the /admin/content manager (imported only by
 * the server `page.tsx`). Kept separate from the client-safe `content-view.ts`
 * (types + section constants) so importing those into a client component never
 * pulls Prisma into the browser bundle. One parallel load, plain objects
 * (Decimal → string) handed to the client shell.
 */

interface AboutContent {
  body?: string;
}

export async function loadContent(): Promise<ContentData> {
  // One round-trip, four reads — no waterfall (server-parallel-fetching).
  const [aboutRow, services, faq, gallery] = await Promise.all([
    prisma.siteContent.findUnique({ where: { key: "about" } }),
    prisma.service.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    prisma.fAQItem.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    prisma.galleryPhoto.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  return {
    about: (aboutRow?.content as AboutContent | null)?.body ?? "",
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price: s.price.toString(),
      durationMin: s.durationMin,
      order: s.order,
      published: s.published,
    })),
    faq: faq.map((q) => ({
      id: q.id,
      question: q.question,
      answer: q.answer,
      category: q.category,
      order: q.order,
      published: q.published,
    })),
    gallery: gallery.map((p) => ({
      id: p.id,
      url: p.url,
      caption: p.caption,
      order: p.order,
      published: p.published,
    })),
  };
}
