import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LAB_VARIANTS } from "@/components/landing-labs/_shared/lab-meta";
import { LabThemeToggle } from "@/components/landing-labs/_shared/LabThemeToggle";

export const metadata: Metadata = {
  title: "Landing Labs",
  robots: { index: false, follow: false },
};

/**
 * /landing-labs — index gallery. Five alternative landing concepts for
 * PIERCERKZN, each a full-page experience. The production landing (/) is
 * untouched; this is a design sandbox.
 */
export default function LandingLabsIndex() {
  return (
    <main className="relative min-h-[100svh] bg-bg text-ink">
      {/* faint grid atmosphere */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(var(--ink-line) 1px, transparent 1px), linear-gradient(90deg, var(--ink-line) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 75%)",
        }}
      />

      <header className="relative mx-auto flex max-w-[1100px] items-start justify-between gap-6 px-[clamp(20px,5vw,64px)] pt-[clamp(28px,5vh,56px)]">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.34em] text-mute">
            PIERCERKZN · Design Sandbox
          </p>
          <h1 className="mt-4 font-display text-[clamp(40px,9vw,104px)] font-bold leading-[0.92] tracking-[-0.03em]">
            Landing
            <br />
            <span className="text-accent">Labs</span>
          </h1>
          <p className="mt-6 max-w-[44ch] text-balance text-[clamp(14px,1.4vw,17px)] leading-relaxed text-mute">
            Пять самостоятельных концепций главной страницы — каждая
            full-page-сценарий со своей режиссурой, типографикой и 3D.
            Текущий лендинг остаётся нетронутым.
          </p>
        </div>
        <LabThemeToggle className="mt-2 shrink-0" />
      </header>

      <ol className="relative mx-auto mt-[clamp(40px,7vh,80px)] grid max-w-[1100px] gap-px border-y border-ink-line px-[clamp(20px,5vw,64px)] pb-[clamp(60px,12vh,140px)]">
        {LAB_VARIANTS.map((v) => (
          <li key={v.slug}>
            <Link
              href={`/landing-labs/${v.slug}`}
              className="group grid grid-cols-[auto_1fr_auto] items-baseline gap-x-[clamp(16px,4vw,56px)] gap-y-2 border-b border-ink-line py-[clamp(22px,3.5vh,40px)] no-underline outline-none transition-colors hover:bg-ink/[0.03] focus-visible:bg-ink/[0.05] sm:items-center"
            >
              <span className="font-mono text-[13px] tabular-nums text-mute transition-colors group-hover:text-accent">
                {v.no}
              </span>

              <span className="col-start-2 min-w-0">
                <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="font-display text-[clamp(24px,4.4vw,52px)] font-bold leading-none tracking-[-0.02em] transition-transform duration-300 group-hover:translate-x-1">
                    {v.title}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-mute">
                    {v.codename}
                  </span>
                </span>
                <span className="mt-2 block max-w-[60ch] text-[13px] leading-snug text-mute sm:text-[14px]">
                  {v.pitch}
                </span>
              </span>

              <span className="col-start-3 row-start-1 flex items-center gap-3 justify-self-end sm:row-span-2">
                <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-mute md:inline">
                  {v.register}
                </span>
                <span
                  className="flex size-10 items-center justify-center rounded-full border border-ink-line-strong text-ink transition-all duration-300 group-hover:border-accent group-hover:bg-accent group-hover:text-on-primary"
                  aria-hidden="true"
                >
                  <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:rotate-45" />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <footer className="relative mx-auto max-w-[1100px] px-[clamp(20px,5vw,64px)] pb-16">
        <Link
          href="/"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute no-underline transition-colors hover:text-ink"
        >
          ← Текущий лендинг (production)
        </Link>
      </footer>
    </main>
  );
}
