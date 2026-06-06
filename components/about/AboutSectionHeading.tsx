import { BlurReveal } from "@/components/motion/BlurReveal";

// Shared section heading for the About bands: a short rule tick over a muted
// uppercase eyebrow, then the display-font title and an optional lead. Extracted
// from the original page so every variant reads the same.
//
// `animated` opts into the Dossier page's scroll-reveal choreography: the
// eyebrow, title, and lead each blur-focus in (the house entrance shared by the
// section grids), cascaded top-to-bottom so the whole band reads as one motion.
// The hero h1 / pull-quote keep the showier word-stream so they stay the page's
// focal reveal; the repeated section headers stay calmer.
export function AboutSectionHeading({
  eyebrow,
  title,
  lead,
  className = "mb-8 max-w-2xl",
  animated = false,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  className?: string;
  animated?: boolean;
}) {
  if (animated) {
    return (
      <header className={className}>
        {eyebrow ? (
          <BlurReveal
            as="div"
            index={0}
            amount={0.6}
            className="mb-3 flex items-center gap-3"
          >
            <span aria-hidden className="h-px w-8 bg-ink-line-strong" />
            <p className="text-xs uppercase tracking-[0.3em] text-mute">
              {eyebrow}
            </p>
          </BlurReveal>
        ) : null}
        <BlurReveal as="div" index={1} amount={0.6}>
          <h2 className="font-display text-3xl font-medium text-ink sm:text-4xl">
            {title}
          </h2>
        </BlurReveal>
        {lead ? (
          <BlurReveal as="div" index={2} amount={0.6}>
            <p className="mt-2 text-mute">{lead}</p>
          </BlurReveal>
        ) : null}
      </header>
    );
  }

  return (
    <header className={className}>
      {eyebrow ? (
        <div className="mb-3 flex items-center gap-3">
          <span aria-hidden className="h-px w-8 bg-ink-line-strong" />
          <p className="text-xs uppercase tracking-[0.3em] text-mute">
            {eyebrow}
          </p>
        </div>
      ) : null}
      <h2 className="font-display text-3xl font-medium text-ink sm:text-4xl">
        {title}
      </h2>
      {lead ? <p className="mt-2 text-mute">{lead}</p> : null}
    </header>
  );
}
