import type { Metadata } from "next";
import Link from "next/link";
import { reviewsStrings, ru } from "@/lib/i18n/ru";
import { Section } from "@/components/ui/Section";

// Skip build-time prerender — wraps the public layout that reads Settings.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${reviewsStrings.thanks.title} — ${ru.studio.name}`,
  robots: { index: false },
};

export default function ReviewThanksPage() {
  return (
    <Section>
      <div className="mx-auto max-w-xl text-center">
        <h1 className="font-display text-3xl font-medium text-ink sm:text-4xl">
          {reviewsStrings.thanks.title}
        </h1>
        <p className="mt-3 text-mute">{reviewsStrings.thanks.body}</p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-on-primary transition-colors hover:bg-primary-soft"
        >
          {reviewsStrings.thanks.backToHome}
        </Link>
      </div>
    </Section>
  );
}
