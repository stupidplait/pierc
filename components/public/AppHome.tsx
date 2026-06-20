import Link from "next/link";
import { ru } from "@/lib/i18n/ru";
import { BrandMark } from "@/components/ui/BrandMark";
import { Section } from "@/components/ui/Section";
import { ContentBackdrop } from "@/components/backdrop/ContentBackdrop";

/**
 * AppHome — the Home tab for the native mobile shell (mobile/).
 *
 * The website's actual landing (`/`) is a desktop, scroll-driven WebGL
 * experience that doesn't render in a WebView and is the wrong shape for a
 * phone home screen. The shell's Home tab loads this route instead: a quiet,
 * native-feeling launcher into the primary surfaces, plus links to the
 * secondary pages that no longer have a site header to live in. Pure DOM/CSS
 * (reuses the auth-page backdrop) — no 3D, no client JS.
 */

// Primary destinations — the four things a customer comes to do.
const PRIMARY: { href: string; title: string; lead: string; cta?: boolean }[] = [
  { href: "/catalog", title: ru.nav.catalog, lead: ru.pages.catalog.lead },
  { href: "/book", title: ru.nav.book, lead: ru.pages.book.lead, cta: true },
  { href: "/services", title: ru.nav.services, lead: ru.pages.services.lead },
  { href: "/gallery", title: ru.nav.gallery, lead: ru.pages.gallery.lead },
];

// Secondary, informational pages — no longer reachable from the (hidden) site
// header, so surfaced here (and in /account).
const SECONDARY: { href: string; label: string }[] = [
  { href: "/about", label: ru.nav.about },
  { href: "/faq", label: ru.nav.faq },
];

const CARD =
  "group relative flex flex-col gap-2 rounded-2xl border border-line bg-card p-6 no-underline " +
  "shadow-elev " +
  "transition-colors duration-200 hover:border-ink-line-strong active:scale-[0.99] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export function AppHome() {
  return (
    <>
      <ContentBackdrop />

      <Section className="relative z-10">
        <header className="flex flex-col items-start gap-5">
          <BrandMark className="size-12" />
          <div>
            <h1 className="font-display text-4xl font-medium tracking-tight text-ink">
              {ru.studio.name}
            </h1>
            <p className="mt-3 max-w-md text-balance text-mute">
              {ru.studio.shortAbout}
            </p>
          </div>
        </header>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {PRIMARY.map((c) => (
            <Link key={c.href} href={c.href} className={CARD}>
              <span className="flex items-center gap-2 font-display text-xl font-medium text-ink">
                {c.cta ? (
                  <span
                    aria-hidden
                    className="size-[6px] rounded-full bg-accent"
                  />
                ) : null}
                {c.title}
              </span>
              <span className="text-sm text-mute">{c.lead}</span>
              <ArrowIcon className="absolute right-5 top-6 text-mute transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink" />
            </Link>
          ))}
        </div>

        <nav
          aria-label="Дополнительно"
          className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-line pt-6"
        >
          {SECONDARY.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-mute no-underline transition-colors duration-150 hover:text-accent"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </Section>
    </>
  );
}

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
