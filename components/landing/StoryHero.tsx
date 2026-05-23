import Link from "next/link";
import { ru } from "@/lib/i18n/ru";

export function StoryHero() {
  const t = ru.pages.home.hero;
  return (
    <section
      id="story-hero"
      className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center px-6 py-12 sm:px-8"
    >
      <div className="flex max-w-2xl flex-col items-center gap-8 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-primary">
          {t.eyebrow}
        </p>
        <h1 className="font-display text-5xl font-medium leading-[1.05] text-balance text-ink sm:text-7xl">
          {t.title}
        </h1>
        <p className="max-w-xl text-balance text-mute sm:text-lg">{t.lead}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
          <a
            href="#story-ch1"
            className="inline-flex h-12 items-center rounded-full bg-primary px-7 font-medium text-on-primary transition-colors hover:bg-primary-soft"
          >
            {t.cta}
          </a>
          <Link
            href="/catalog"
            className="text-sm text-mute transition-colors hover:text-primary"
          >
            {t.skipToCatalog} →
          </Link>
        </div>
      </div>
    </section>
  );
}
