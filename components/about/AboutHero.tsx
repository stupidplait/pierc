import { ArrowUpRight, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BrandMark } from "@/components/ui/BrandMark";
import { BlurReveal } from "@/components/motion/BlurReveal";
import { WordReveal } from "@/components/motion/WordReveal";
import type { AboutStrings } from "./types";

/**
 * About hero — an oversized statement with the brand mark (X-in-ring) set into
 * the upper-right where it reads as a quiet watermark on the void, the title
 * streaming in word-by-word a beat after the lead, and the two primary CTAs.
 *
 * Server component; the reveals/buttons are the client leaves.
 */
export function AboutHero({
  t,
  servicesLabel,
}: {
  t: AboutStrings;
  servicesLabel: string;
}) {
  return (
    <div className="relative mb-16 sm:mb-24">
      {/* Watermark brand mark — positioned on the static wrapper so the
          entrance's transform (scale) never fights the -translate-y-1/2. */}
      <div className="pointer-events-none absolute right-0 top-1/2 hidden h-[clamp(280px,32vw,500px)] w-auto -translate-y-1/2 md:block">
        <BlurReveal as="div" trigger="mount" delay={0.2} className="h-full">
          <BrandMark className="h-full w-auto" />
        </BlurReveal>
      </div>
      <div className="relative z-10 flex min-h-[50svh] max-w-3xl flex-col justify-center lg:min-h-[56svh]">
        <WordReveal
          as="h1"
          text={t.title}
          delay={0.25}
          className="font-display text-5xl font-medium tracking-tight text-ink text-balance sm:text-7xl"
        />
        <WordReveal
          as="p"
          text={t.lead}
          delay={0.05}
          className="mt-6 max-w-xl text-lg text-mute text-balance"
        />
        <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <BlurReveal as="div" trigger="mount" delay={0.45} index={0} className="max-sm:w-full">
            <Button href="/book" size="lg" radius="rounded-xl" className="gap-2 max-sm:w-full">
              <CalendarPlus className="size-5" aria-hidden />
              {t.ctaLabel}
            </Button>
          </BlurReveal>
          <BlurReveal as="div" trigger="mount" delay={0.45} index={1} className="max-sm:w-full">
            <Button
              href="/services"
              variant="secondary"
              size="lg"
              radius="rounded-xl"
              className="group gap-2 max-sm:w-full"
            >
              {servicesLabel}
              <ArrowUpRight
                className="size-5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden
              />
            </Button>
          </BlurReveal>
        </div>
      </div>
    </div>
  );
}
