import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ru, seoStrings } from "@/lib/i18n/ru";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { Section } from "@/components/ui/Section";
import { AuthBackdrop } from "@/components/landing/auth/AuthBackdrop";
import { WordReveal } from "@/components/about/client/WordReveal";
import { BlockReveal } from "@/components/services/entrance/BlockReveal";
import { BookingForm } from "@/components/booking/BookingForm";
import { getOpenSlots } from "@/lib/booking/slot-actions";
import { getBookingPrefillUser } from "@/lib/public/queries";
import { firstPhotoUrl } from "@/lib/jewelry/format";
import type {
  WizardJewelry,
  WizardService,
} from "@/lib/booking/wizard-types";

export const metadata: Metadata = buildPageMetadata({
  title: seoStrings.book.title,
  description: seoStrings.book.description,
  path: "/book",
});

// Skip build-time prerender — reads Settings + slot data on every request.
export const dynamic = "force-dynamic";

interface BookPageProps {
  searchParams: Promise<{ items?: string }>;
}

function parseCsv(s: string | undefined): string[] {
  if (!s) return [];
  const out: string[] = [];
  for (const raw of s.split(",")) {
    const t = raw.trim();
    if (t) out.push(t);
  }
  return out;
}

export default async function BookPage({ searchParams }: BookPageProps) {
  const sp = await searchParams;
  const initialItemIds = parseCsv(sp.items);

  const [servicesDb, jewelryDb, slots, user] = await Promise.all([
    prisma.service.findMany({
      where: { published: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        durationMin: true,
      },
    }),
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
    getOpenSlots(),
    getBookingPrefillUser(),
  ]);

  const services: WizardService[] = servicesDb.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    price: s.price.toString(),
    durationMin: s.durationMin,
  }));

  const jewelry: WizardJewelry[] = jewelryDb.map((j) => ({
    id: j.id,
    name: j.name,
    price: j.price.toString(),
    photo: firstPhotoUrl(j.photos),
    inStock: j.inStock,
  }));

  return (
    <>
      {/* Same drifting-grid + dotted backdrop as the about/faq/services pages —
          fixed behind the content, carrying the single magenta accent dot. The
          content rides above it at z-10. */}
      <AuthBackdrop />

      <Section className="relative z-10">
        <div className="mx-auto max-w-5xl">
          {/* Hero matches the other content pages: title streams in char-by-char
              (WordReveal), lead a beat later — replacing the static header. */}
          <header className="mb-12 sm:mb-16">
            <WordReveal
              text={ru.pages.book.title}
              as="h1"
              splitBy="char"
              amount={0.6}
              className="font-display text-4xl font-medium tracking-tight text-ink text-balance sm:text-6xl"
            />
            <WordReveal
              text={ru.pages.book.lead}
              as="p"
              delay={0.18}
              amount={0.6}
              className="mt-5 max-w-2xl text-lg text-mute text-balance sm:mt-6"
            />
          </header>

          {/* Blur-focus the form in on mount, echoing the services cards. */}
          <BlockReveal delay={0.1}>
            <BookingForm
              services={services}
              jewelry={jewelry}
              slots={slots}
              user={user}
              initialItemIds={initialItemIds}
            />
          </BlockReveal>
        </div>
      </Section>
    </>
  );
}
